---
tags:
  - Network
  - Windows
---

# :material-dog: BloodHound & AD Pathing

<span class="pill pill-medium">map the domain</span> <span class="pill pill-info">network</span>

BloodHound turns AD's tangle of ACLs, group memberships, and sessions into a graph — so you can ask "what's the shortest path from *me* to Domain Admin?"

!!! abstract "TL;DR"
    Collect the domain graph with any valid creds, import to BloodHound, and run the built-in queries for shortest paths and juicy misconfigurations.

## :material-download: Collect

```bash
# Python collector (no Windows box needed)
bloodhound-python -u user -p pass -d corp.local -ns 10.10.10.5 -c All

# or the C# collector on a domain host
SharpHound.exe -c All --zipfilename loot.zip
```

## :material-graph: Analyze

Import the zip, then use pre-built queries:

- *Shortest Paths to Domain Admins*
- *Find Principals with DCSync Rights*
- *Kerberoastable users* / *AS-REP roastable users*
- *Dangerous ACLs* (`GenericAll`, `WriteDacl`, `ForceChangePassword`)

## :material-arrow-decision: Abuse the edges

| Edge | Abuse |
| --- | --- |
| `GenericAll` on user | Reset their password / targeted Kerberoast |
| `WriteDacl` on group | Add yourself, inherit its rights |
| `AddMember` | Join a privileged group |
| `DCSync` | Dump all domain hashes |

!!! opsec "Collection touches everything"
    `-c All` queries every host for sessions — noisy. Scope collectors (`-c DCOnly`) when stealth matters.

## :material-code-braces: Custom Cypher queries

Paste these into BloodHound's **raw query** box (or drop them into `customqueries.json`) to go beyond the built-ins. They assume the legacy SharpHound schema (`owned`, `highvalue`, `hasspn`, …) — BloodHound CE renamed a few props, but the shapes translate directly.

!!! tip "Mark owned first"
    Almost every query below keys off `{owned:true}`. Right-click → *Mark as Owned* on everything you control, then these turn a static graph into *your next move*.

**Owned principals & pathing to loot**

```cypher
// Everything you've marked owned
MATCH (m) WHERE m.owned=TRUE RETURN m

// Groups your owned users are in (direct, then unrolled/nested)
MATCH p=(u:User {owned:true})-[:MemberOf]->(g:Group) RETURN p
MATCH (m:User {owned:true}) MATCH p=(m)-[:MemberOf*1..]->(n:Group) RETURN p

// Shortest paths from owned -> High Value Targets (all abusable edges, 5 hops)
MATCH p=shortestPath((n {owned:true})-[:MemberOf|HasSession|AdminTo|AllExtendedRights|AddMember|ForceChangePassword|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|CanRDP|ExecuteDCOM|AllowedToDelegate|ReadLAPSPassword|Contains|GpLink|AddAllowedToAct|AllowedToAct|SQLAdmin|ReadGMSAPassword|HasSIDHistory|CanPSRemote*1..5]->(m {highvalue:true}))
WHERE NOT n=m RETURN p

// "Most exploitable" variant — drops HasSession/CanRDP for edges you can abuse unattended
MATCH p=allShortestPaths((n {owned:true})-[:MemberOf|AdminTo|AllExtendedRights|AddMember|ForceChangePassword|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|ExecuteDCOM|AllowedToDelegate|ReadLAPSPassword|Contains|GpLink|AddAllowedToAct|AllowedToAct|SQLAdmin|ReadGMSAPassword|HasSIDHistory*1..5]->(m {highvalue:true}))
WHERE NOT n=m RETURN p

// "What can I reach at all?" — any edge, 3 or 5 hops from owned
MATCH p=shortestPath((c {owned:true})-[*1..3]->(s)) WHERE NOT c=s RETURN p

// Owned users holding rights over GPOs
MATCH p=(u:User {owned:true})-[:AllExtendedRights|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|GpLink*1..]->(g:GPO) RETURN p
```

**Kerberos roasting targets**

```cypher
MATCH (n:User) WHERE n.hasspn=true RETURN n                            // Kerberoastable
MATCH (u:User {dontreqpreauth:true}) RETURN u                          // AS-REP roastable

// Kerberoastable with a path to Domain Admins (-512) / any High Value
MATCH (u:User {hasspn:true}),(g:Group) WHERE g.objectid ENDS WITH '-512'
MATCH p=shortestPath((u)-[*1..]->(g)) RETURN p
MATCH (u:User {hasspn:true}),(n {highvalue:true}) MATCH p=shortestPath((u)-[*1..]->(n)) RETURN p

// Kerberoastable users that are members of a high-value group
MATCH (u:User)-[:MemberOf*1..]->(g:Group) WHERE g.highvalue=true AND u.hasspn=true RETURN u
```

**Delegation (RBCD / (un)constrained)**

```cypher
MATCH (c {unconstraineddelegation:true}) RETURN c                       // unconstrained delegation
// ...excluding domain controllers (the interesting ones)
MATCH (c1:Computer)-[:MemberOf*1..]->(g:Group) WHERE g.objectid ENDS WITH '-516'
WITH COLLECT(c1.name) AS DCs
MATCH (c2 {unconstraineddelegation:true}) WHERE NOT c2.name IN DCs RETURN c2

MATCH (c) WHERE NOT c.allowedtodelegate IS NULL AND c.trustedtoauth=true  RETURN c   // constrained + protocol transition (S4U)
MATCH (c) WHERE NOT c.allowedtodelegate IS NULL AND c.trustedtoauth=false RETURN c   // constrained, no transition
MATCH p=(u)-[:AllowedToAct]->(c) RETURN p                               // resource-based (RBCD)
MATCH p=(g)-[:AddAllowedToAct|WriteAccountRestrictions]->(c:Computer) RETURN p        // who can *set up* RBCD

// Shortest path from owned -> an unconstrained-delegation box (then coerce a DC)
MATCH (n {owned:true}) MATCH p=shortestPath((n)-[*1..]->(m:Computer {unconstraineddelegation:true})) WHERE NOT n=m RETURN p
```

**Sessions, local admin & object control**

```cypher
MATCH p=(m:User)-[:AdminTo]->(n:Computer) RETURN p                      // users with local admin
MATCH p=(m:Group)-[:AdminTo]->(n:Computer) RETURN p                     // groups with local admin (heavy)
MATCH p=(c1:Computer)-[:AdminTo]->(c2:Computer) RETURN p                // computers admin to computers

// Domain Admins with live sessions (grab their creds)
MATCH (n:User)-[:MemberOf]->(g:Group) WHERE g.objectid ENDS WITH '-512'
MATCH p=(c:Computer)-[:HasSession]->(n) RETURN p

// Logged-in admins (session on a box they administer)
MATCH (a:Computer)-[:HasSession]->(b:User) WITH a,b MATCH p=shortestPath((b)-[:AdminTo|MemberOf*1..]->(a)) RETURN p

// Top-10 highest-value footholds
MATCH (n:User)-[r:HasSession]-(m:Computer) WHERE NOT n.name STARTS WITH 'ANONYMOUS LOGON' AND n.name<>''
WITH n, count(r) AS c ORDER BY c DESC LIMIT 10 MATCH p=(m)-[:HasSession]->(n) RETURN p    // most-sessioned users
MATCH (n:User)-[r:AdminTo]->(m:Computer) WITH n, count(r) AS c ORDER BY c DESC LIMIT 10
MATCH p=(m)<-[:AdminTo]-(n) RETURN p                                                       // users with most local admin

// Nodes wielding the most control (first-degree ACLs, then via group delegation)
MATCH (u)-[r:MemberOf*0..]->()-[r2]->(n) WHERE r2.isacl=true WITH u, count(r2) AS c ORDER BY c DESC LIMIT 20 RETURN u
```

**Groups, ACL abuse & RDP reach**

```cypher
MATCH (n:Group) WHERE n.name CONTAINS 'ADMIN' RETURN n                  // admin-ish groups
MATCH p=(m:Group)-[:ForceChangePassword]->(n:User) RETURN p            // groups that can reset passwords
MATCH p=(n:User)-[:MemberOf*1..]->(m:Group {highvalue:true}) RETURN p   // who's in HVT groups
MATCH (n:User {admincount:false}) MATCH p=allShortestPaths((n)-[:AddMember*1..]->(m:Group)) RETURN p  // unpriv users who can AddMember

// Non-admin groups with dangerous rights over computers
MATCH p=(g:Group)-[:Owns|WriteDacl|GenericAll|WriteOwner|ExecuteDCOM|GenericWrite|AllowedToDelegate|ForceChangePassword]->(n:Computer)
WHERE NOT g.name CONTAINS 'ADMIN' RETURN p

// RDP reach for the low-priv masses
MATCH p=(g:Group)-[:CanRDP]->(c:Computer) WHERE g.objectid ENDS WITH '-513' RETURN p         // Domain Users can RDP
MATCH p=(g:Group)-[:CanRDP]->(c:Computer) WHERE g.name STARTS WITH 'DOMAIN USERS' AND c.operatingsystem CONTAINS 'Server' RETURN p
```

**Stale / hygiene / quick wins**

```cypher
MATCH (n:User) WHERE n.lastlogontimestamp=-1.0 AND n.enabled=true RETURN n     // never logged on, still enabled
MATCH p=(u:User)-[:MemberOf]->(g:Group) WHERE toUpper(g.name) CONTAINS 'VPN' RETURN p  // VPN-entitled users
MATCH (n:GPO) RETURN n                                                          // all GPOs
MATCH (c:Computer) WHERE toUpper(c.operatingsystem) =~ '.*(XP|2000|2003|2008|VISTA).*' RETURN c   // EOL boxes

// Config hygiene (SharpHound + GPOHound props)
MATCH (n:Computer) WHERE n.smbSigningRequired = false RETURN n                 // SMB signing not required -> relay
MATCH (n:Computer) WHERE n.NTLMv1Support = true RETURN n                       // NTLMv1 downgrade
MATCH (n:Computer) WHERE ANY(k IN keys(n) WHERE toLower(k) CONTAINS 'vnc' AND toLower(k) CONTAINS 'pass') RETURN n
```

**AD CS escalation (ESC1-8)**

```cypher
// ESC1 — enrollee-supplies-subject + client auth
MATCH (n:GPO) WHERE n.type='Certificate Template' AND n.`Enrollee Supplies Subject`=true AND n.`Client Authentication`=true AND n.Enabled=true RETURN n
MATCH p=allShortestPaths((g {owned:true})-[*1..]->(n:GPO)) WHERE g<>n AND n.type='Certificate Template' AND n.`Enrollee Supplies Subject`=true AND n.`Client Authentication`=true AND n.Enabled=true RETURN p

// ESC2 (Any Purpose EKU) / ESC3 (Enrollment Agent)
MATCH (n:GPO) WHERE n.type='Certificate Template' AND n.Enabled=true AND (n.`Extended Key Usage`=[] OR 'Any Purpose' IN n.`Extended Key Usage`) RETURN n
MATCH (n:GPO) WHERE n.type='Certificate Template' AND n.Enabled=true AND (n.`Extended Key Usage`=[] OR 'Any Purpose' IN n.`Extended Key Usage` OR 'Certificate Request Agent' IN n.`Extended Key Usage`) RETURN n

// ESC4 — vulnerable template ACL (write it into an ESC1)
MATCH p=shortestPath((g)-[:GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner*1..]->(n:GPO)) WHERE g<>n AND n.type='Certificate Template' AND n.Enabled=true RETURN p

// ESC6 (user-specified SAN on CA) / ESC7 (CA ACL) / ESC8 (HTTP web enrollment -> relay)
MATCH (n:GPO) WHERE n.type='Enrollment Service' AND n.`User Specified SAN`='Enabled' RETURN n
MATCH p=shortestPath((g)-[:GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|ManageCa|ManageCertificates*1..]->(n:GPO)) WHERE g<>n AND n.type='Enrollment Service' RETURN p
MATCH (n:GPO) WHERE n.type='Enrollment Service' AND n.`Web Enrollment`='Enabled' RETURN n
```

**Azure (AzureHound)**

```cypher
MATCH p=(n)-[:AZGlobalAdmin*1..]->(m) RETURN p                          // Global Admins
MATCH p=(m:User)-[:AZResetPassword|AZOwns|AZUserAccessAdministrator|AZContributor|AZAddMembers|AZGlobalAdmin|AZVMContributor]->(n)
WHERE m.objectid CONTAINS 'S-1-5-21' RETURN p                           // on-prem users with edges into Azure
MATCH p=(n)-[r]->(g:AZKeyVault) RETURN p                                // paths to a Key Vault
MATCH p=(g:AZServicePrincipal)-[r]->(n) RETURN p                        // privileged service principals
MATCH (n:Group) WHERE n.objectid CONTAINS 'S-1-5' AND n.azsyncid IS NOT NULL RETURN n   // synced on-prem groups
```

**After cracking (plaintext password props loaded)**

```cypher
// Users whose cracked password is seasonal AND who reach a High Value Target
MATCH (u:User) WHERE u.plaintextpassword =~ '([Ww]inter.*|[sS]pring.*|[sS]ummer.*|[fF]all.*)'
MATCH p=(u)-[:MemberOf*1..]->(m:Group {highvalue:true}) RETURN u
// ...or a "password"-variant AND local admin somewhere
MATCH (u:User) WHERE u.plaintextpassword =~ '(.*[pP][aA@][sS$][sS$][wW][oO0][rR][dD].*)'
MATCH p=(u)-[:AdminTo]->(n:Computer) RETURN p
```

**Triage by volume (biggest blast radius first)**

```cypher
// Top ten users by session count — where the credentials actually are
MATCH (n:User),(m:Computer),(n)<-[r:HasSession]-(m)
WHERE NOT n.name STARTS WITH 'ANONYMOUS LOGON' AND NOT n.name=''
WITH n, count(r) AS rel_count ORDER BY rel_count DESC LIMIT 10
MATCH p=(m)-[:HasSession]->(n) RETURN p

// Swap `WITH n` for `WITH m` to rank computers instead of users.
// Same shape with -[r:AdminTo]-> ranks most-admined boxes / most-privileged users.

// Top 20 nodes by first-degree object control (direct ACLs)
MATCH p=(u)-[r1]->(n) WHERE r1.isacl = true
WITH u, count(r1) AS count_ctrl ORDER BY count_ctrl DESC LIMIT 20 RETURN u

// ...and by control inherited through group membership
MATCH p=(u)-[:MemberOf*1..]->(g:Group)-[r2]->(n) WHERE r2.isacl = true
WITH u, count(r2) AS count_ctrl ORDER BY count_ctrl DESC LIMIT 20 RETURN u
```

!!! loot "Rank before you path"
    On a large collection the graph is unreadable. These order the environment by
    *how much a node touches*, so you pick a target worth pathing to instead of
    eyeballing a hairball. The most-sessions box is usually where DA creds sit.

**Cross-domain & forest edges**

```cypher
// Anything crossing a domain/forest boundary
MATCH p=(a)-[r]->(b) WHERE NOT a.domain = b.domain RETURN p

// Same, but only ACL edges — the ones you can actually abuse
MATCH p=(a)-[r]->(b) WHERE NOT a.domain = b.domain AND r.isacl = true RETURN p
```

**Group/ACL oddities worth a look**

```cypher
// adminCount users that are NOT sensitive-for-delegation and NOT in Protected Users
MATCH (u)-[:MemberOf*1..]->(g:Group) WHERE g.objectid =~ '(?i)S-1-5-.*-525'
WITH COLLECT(u.name) AS protectedUsers
MATCH p=(u2:User)-[:MemberOf*1..3]->(g2:Group)
WHERE u2.admincount=true AND u2.sensitive=false AND NOT u2.name IN protectedUsers
RETURN p

// Groups holding BOTH computer and user objects — often forgotten legacy groups
MATCH (c:Computer)-[:MemberOf*1..]->(g:Group)
WITH g MATCH (u:User)-[:MemberOf*1..]->(g)
RETURN DISTINCT(g)
```

!!! bug "Legacy (v4) vs BloodHound CE — why a query returns nothing"
    These queries target the **legacy SharpHound/BloodHound v4** schema. On
    **CE (v5+)** several silently return zero rows:

    - `{highvalue:true}` → CE uses `system_tags` (`WHERE n.system_tags CONTAINS 'admin_tier_0'`).
    - AD CS objects used to be `GPO` nodes matched with `n.type = 'Certificate Template'`;
      CE has real labels — `CertTemplate`, `EnterpriseCA`, `RootCA`, `NTAuthStore` —
      so every `n.type = '…'` cert query needs rewriting against those.
    - `[r:A|:B|:C]` (colon before each type) is deprecated in Neo4j 5 — write `[r:A|B|C]`.

    `owned`, `hasspn`, `dontreqpreauth`, `unconstraineddelegation` and the edge
    names are unchanged, so most pathing queries port over untouched.

??? example "Drop-in `customqueries.json` — import the whole pack at once"
    Save to the path for your build, restart BloodHound, and they appear under
    **Analysis → pre-built queries**. Categories are renamed to what they do
    rather than the pack's original joke names.

    ```text
    Linux    ~/.config/bloodhound/customqueries.json
    Windows  %USERPROFILE%\AppData\Roaming\bloodhound\customqueries.json
    macOS    ~/Library/Application Support/bloodhound/customqueries.json
    ```

    Five queries in the pack as published do not execute — fixed here: the
    `u1`/`u` variable mismatch in the kerberoastable-AdminTo query, a double
    `WHERE` in the 5-year-password query, `m[.]name` instead of `m.name`, a
    missing `|` in `AZOwnsAZAvereContributor`, and the deprecated `|:` edge
    syntax. The two `SET … highvalue = true` queries **write to your database**
    — they are prefixed `(EDITS DB)`.

    ```json
    {
      "queries": [
        {
          "name": "Owned objects",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (m) WHERE m.owned=TRUE RETURN m"
            }
          ]
        },
        {
          "name": "Direct groups of owned users",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User {owned:true}), (g:Group), p=(u)-[:MemberOf]->(g) RETURN p"
            }
          ]
        },
        {
          "name": "Unrolled groups of owned users",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (m:User) WHERE m.owned=TRUE WITH m MATCH p=(m)-[:MemberOf*1..]->(n:Group) RETURN p"
            }
          ]
        },
        {
          "name": "Shortest paths from owned to HVT (5 hops)",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=shortestPath((n {owned:true})-[:MemberOf|HasSession|AdminTo|AllExtendedRights|AddMember|ForceChangePassword|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|CanRDP|ExecuteDCOM|AllowedToDelegate|ReadLAPSPassword|Contains|GpLink|AddAllowedToAct|AllowedToAct|SQLAdmin|ReadGMSAPassword|HasSIDHistory|CanPSRemote*1..5]->(m {highvalue:true})) WHERE NOT n=m RETURN p"
            }
          ]
        },
        {
          "name": "Most exploitable paths from owned to HVT (5 hops)",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=allShortestPaths((n {owned:true})-[:MemberOf|AdminTo|AllExtendedRights|AddMember|ForceChangePassword|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|ExecuteDCOM|AllowedToDelegate|ReadLAPSPassword|Contains|GpLink|AddAllowedToAct|AllowedToAct|SQLAdmin|ReadGMSAPassword|HasSIDHistory*1..5]->(m {highvalue:true})) WHERE NOT n=m RETURN p"
            }
          ]
        },
        {
          "name": "Next steps (5 hops) from owned",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=shortestPath((c {owned: true})-[*1..5]->(s)) WHERE NOT c = s RETURN p"
            }
          ]
        },
        {
          "name": "Next steps (3 hops) from owned",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=shortestPath((c {owned: true})-[*1..3]->(s)) WHERE NOT c = s RETURN p"
            }
          ]
        },
        {
          "name": "Connections between different domains/forests",
          "category": "Cross-domain",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p = (a)-[r]->(b) WHERE NOT a.domain = b.domain RETURN p"
            }
          ]
        },
        {
          "name": "Connections (ACEs only) between domains/forests",
          "category": "Cross-domain",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p = (a)-[r]->(b) WHERE NOT a.domain = b.domain AND r.isacl = True RETURN p"
            }
          ]
        },
        {
          "name": "Owned users with permissions against GPOs",
          "category": "Owned & pathing",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(u:User {owned:true})-[r:AllExtendedRights|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|GpLink*1..]->(g:GPO) RETURN p"
            }
          ]
        },
        {
          "name": "Kerberoastable users with a path to DA",
          "category": "Kerberos roasting",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User {hasspn:true}) MATCH (g:Group) WHERE g.objectid ENDS WITH '-512' MATCH p = shortestPath( (u)-[*1..]->(g) ) RETURN p"
            }
          ]
        },
        {
          "name": "Kerberoastable users with a path to High Value",
          "category": "Kerberos roasting",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User {hasspn:true}),(n {highvalue:true}),p = shortestPath( (u)-[*1..]->(n) ) RETURN p"
            }
          ]
        },
        {
          "name": "Kerberoastable users and where they are AdminTo",
          "category": "Kerberos roasting",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User) WHERE u.hasspn=true OPTIONAL MATCH p=(u)-[:AdminTo]->(c:Computer) RETURN u, p"
            }
          ]
        },
        {
          "name": "Kerberoastable users in high value groups",
          "category": "Kerberos roasting",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User)-[r:MemberOf*1..]->(g:Group) WHERE g.highvalue=true AND u.hasspn=true RETURN u"
            }
          ]
        },
        {
          "name": "Kerberoastable users pwd last set > 5 years",
          "category": "Kerberos roasting",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User) WHERE u.hasspn=true AND u.pwdlastset < (datetime().epochseconds - (1825 * 86400)) AND NOT u.pwdlastset IN [-1.0, 0.0] RETURN u"
            }
          ]
        },
        {
          "name": "Kerberoastable Users",
          "category": "Kerberos roasting",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User)WHERE n.hasspn=true RETURN n"
            }
          ]
        },
        {
          "name": "AS-REProastable Users",
          "category": "Kerberos roasting",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User {dontreqpreauth: true}) RETURN u"
            }
          ]
        },
        {
          "name": "Unconstrained Delegations",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (c {unconstraineddelegation:true}) return c"
            }
          ]
        },
        {
          "name": "Constrained Delegations (with Protocol Transition)",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (c) WHERE NOT c.allowedtodelegate IS NULL AND c.trustedtoauth=true return c"
            }
          ]
        },
        {
          "name": "Constrained Delegations (without Protocol Transition)",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (c) WHERE NOT c.allowedtodelegate IS NULL AND c.trustedtoauth=false return c"
            }
          ]
        },
        {
          "name": "Resource-Based Constrained Delegations",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(u)-[:AllowedToAct]->(c) RETURN p"
            }
          ]
        },
        {
          "name": "Unconstrained Delegation systems (excluding DCs)",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (c1:Computer)-[:MemberOf*1..]->(g:Group) WHERE g.objectid ENDS WITH '-516' WITH COLLECT(c1.name) AS domainControllers MATCH (c2 {unconstraineddelegation:true}) WHERE NOT c2.name IN domainControllers RETURN c2"
            }
          ]
        },
        {
          "name": "(EDITS DB) Mark unconstrained delegation systems as HVT",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (c1:Computer)-[:MemberOf*1..]->(g:Group) WHERE g.objectid ENDS WITH '-516' WITH COLLECT(c1.name) AS domainControllers MATCH (c2 {unconstraineddelegation:true}) WHERE NOT c2.name IN domainControllers SET c2.highvalue = true RETURN c2"
            }
          ]
        },
        {
          "name": "Shortest paths from owned to unconstrained delegation systems",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n {owned:true}) MATCH p=shortestPath((n)-[:MemberOf|HasSession|AdminTo|AllExtendedRights|AddMember|ForceChangePassword|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|ExecuteDCOM|AllowedToDelegate|ReadLAPSPassword|Contains|GpLink|AddAllowedToAct|AllowedToAct|SQLAdmin|ReadGMSAPassword|HasSIDHistory|CanPSRemote*1..]->(m:Computer {unconstraineddelegation: true})) WHERE NOT n=m RETURN p"
            }
          ]
        },
        {
          "name": "Computers admin to other computers",
          "category": "Sessions & local admin",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p = (c1:Computer)-[r1:AdminTo]->(c2:Computer) RETURN p UNION ALL MATCH p = (c3:Computer)-[r2:MemberOf*1..]->(g:Group)-[r3:AdminTo]->(c4:Computer) RETURN p"
            }
          ]
        },
        {
          "name": "Logged in Admins",
          "category": "Sessions & local admin",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(a:Computer)-[r:HasSession]->(b:User) WITH a,b,r MATCH p=shortestPath((b)-[:AdminTo|MemberOf*1..]->(a)) RETURN p"
            }
          ]
        },
        {
          "name": "Users with local admin rights",
          "category": "Sessions & local admin",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(m:User)-[r:AdminTo]->(n:Computer) RETURN p"
            }
          ]
        },
        {
          "name": "Domain admin sessions",
          "category": "Sessions & local admin",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User)-[:MemberOf]->(g:Group) WHERE g.objectid ENDS WITH '-512' MATCH p = (c:Computer)-[:HasSession]->(n) return p"
            }
          ]
        },
        {
          "name": "adminCount users not sensitive & not Protected Users",
          "category": "Sessions & local admin",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u)-[:MemberOf*1..]->(g:Group) WHERE g.objectid =~ \"(?i)S-1-5-.*-525\" WITH COLLECT (u.name) as protectedUsers MATCH p=(u2:User)-[:MemberOf*1..3]->(g2:Group) WHERE u2.admincount=true AND u2.sensitive=false AND NOT u2.name IN protectedUsers RETURN p"
            }
          ]
        },
        {
          "name": "Objects with AddAllowedToAct/WriteAccountRestrictions on a computer",
          "category": "Delegation & RBCD",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(g)-[:AddAllowedToAct|WriteAccountRestrictions]->(c:Computer) RETURN p"
            }
          ]
        },
        {
          "name": "Groups containing 'admin'",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "Match (n:Group) WHERE n.name CONTAINS 'ADMIN' RETURN n"
            }
          ]
        },
        {
          "name": "Groups that can change user passwords (count)",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(m:Group)-[r:ForceChangePassword]->(n:User) RETURN DISTINCT m.name, COUNT(m.name) ORDER BY COUNT(m.name) DESC"
            }
          ]
        },
        {
          "name": "Groups of High Value Targets",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(n:User)-[r:MemberOf*1..]->(m:Group {highvalue:true}) RETURN p"
            }
          ]
        },
        {
          "name": "Non-admin groups with high value privileges",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(g:Group)-[r:Owns|WriteDacl|GenericAll|WriteOwner|ExecuteDCOM|GenericWrite|AllowedToDelegate|ForceChangePassword]->(n:Computer) WHERE NOT g.name CONTAINS 'ADMIN' RETURN p"
            }
          ]
        },
        {
          "name": "Groups with both Computer and User objects",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (c:Computer)-[r:MemberOf*1..]->(groupsWithComps:Group) WITH groupsWithComps MATCH (u:User)-[r:MemberOf*1..]->(groupsWithComps) RETURN DISTINCT(groupsWithComps) as groupsWithCompsAndUsers"
            }
          ]
        },
        {
          "name": "Groups that can reset passwords (heavy)",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(m:Group)-[r:ForceChangePassword]->(n:User) RETURN p"
            }
          ]
        },
        {
          "name": "Groups with local admin rights (heavy)",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(m:Group)-[r:AdminTo]->(n:Computer) RETURN p"
            }
          ]
        },
        {
          "name": "Users never logged on, still enabled",
          "category": "Hygiene & stale objects",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User) WHERE n.lastlogontimestamp=-1.0 AND n.enabled=TRUE RETURN n"
            }
          ]
        },
        {
          "name": "Users not logged in for 90+ days",
          "category": "Hygiene & stale objects",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User) WHERE u.lastlogon < (datetime().epochseconds - (90 * 86400)) and NOT u.lastlogon IN [-1.0, 0.0] RETURN u"
            }
          ]
        },
        {
          "name": "Users with password unchanged for 90+ days",
          "category": "Hygiene & stale objects",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u:User) WHERE u.pwdlastset < (datetime().epochseconds - (90 * 86400)) and NOT u.pwdlastset IN [-1.0, 0.0] RETURN u"
            }
          ]
        },
        {
          "name": "Unprivileged users who can add members to groups",
          "category": "Groups & ACLs",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User {admincount:False}) MATCH p=allShortestPaths((n)-[r:AddMember*1..]->(m:Group)) RETURN p"
            }
          ]
        },
        {
          "name": "All users in the VPN group",
          "category": "Hygiene & stale objects",
          "queryList": [
            {
              "final": true,
              "query": "Match p=(u:User)-[:MemberOf]->(g:Group) WHERE toUPPER (g.name) CONTAINS 'VPN' return p"
            }
          ]
        },
        {
          "name": "View all GPOs",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "Match (n:GPO) RETURN n"
            }
          ]
        },
        {
          "name": "Any domain user with interesting rights on a GPO (heavy)",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(u:User)-[r:AllExtendedRights|GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|GpLink*1..]->(g:GPO) RETURN p"
            }
          ]
        },
        {
          "name": "Top ten users with most sessions",
          "category": "Top-N triage",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User),(m:Computer), (n)<-[r:HasSession]-(m) WHERE NOT n.name STARTS WITH 'ANONYMOUS LOGON' AND NOT n.name='' WITH n, count(r) as rel_count order by rel_count desc LIMIT 10 MATCH p=(m)-[r:HasSession]->(n) RETURN p"
            }
          ]
        },
        {
          "name": "Top ten computers with most sessions",
          "category": "Top-N triage",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User),(m:Computer), (n)<-[r:HasSession]-(m) WHERE NOT n.name STARTS WITH 'ANONYMOUS LOGON' AND NOT n.name='' WITH m, count(r) as rel_count order by rel_count desc LIMIT 10 MATCH p=(m)-[r:HasSession]->(n) RETURN p"
            }
          ]
        },
        {
          "name": "Top ten users with most local admin rights",
          "category": "Top-N triage",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User),(m:Computer), (n)-[r:AdminTo]->(m) WHERE NOT n.name STARTS WITH 'ANONYMOUS LOGON' AND NOT n.name='' WITH n, count(r) as rel_count order by rel_count desc LIMIT 10 MATCH p=(m)<-[r:AdminTo]-(n) RETURN p"
            }
          ]
        },
        {
          "name": "Top ten computers with most admins",
          "category": "Top-N triage",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User),(m:Computer), (n)-[r:AdminTo]->(m) WHERE NOT n.name STARTS WITH 'ANONYMOUS LOGON' AND NOT n.name='' WITH m, count(r) as rel_count order by rel_count desc LIMIT 10 MATCH p=(m)<-[r:AdminTo]-(n) RETURN m"
            }
          ]
        },
        {
          "name": "(EDITS DB) Mark top ten computers with most admins as HVT",
          "category": "Top-N triage",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:User),(m:Computer), (n)-[r:AdminTo]->(m) WHERE NOT n.name STARTS WITH 'ANONYMOUS LOGON' AND NOT n.name='' WITH m, count(r) as rel_count order by rel_count desc LIMIT 10 MATCH p=(m)<-[r:AdminTo]-(n) SET m.highvalue = true RETURN m"
            }
          ]
        },
        {
          "name": "Top 20 nodes with most first-degree object control",
          "category": "Top-N triage",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(u)-[r1]->(n) WHERE r1.isacl = true WITH u, count(r1) AS count_ctrl ORDER BY count_ctrl DESC LIMIT 20 RETURN u"
            }
          ]
        },
        {
          "name": "Top nodes with most group-delegated object control",
          "category": "Top-N triage",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(u)-[r1:MemberOf*1..]->(g:Group)-[r2]->(n) WHERE r2.isacl=true WITH u, count(r2) AS count_ctrl ORDER BY count_ctrl DESC LIMIT 20 RETURN u"
            }
          ]
        },
        {
          "name": "Machines Domain Users can RDP into",
          "category": "RDP & remote exec",
          "queryList": [
            {
              "final": true,
              "query": "match p=(g:Group)-[:CanRDP]->(c:Computer) where g.objectid ENDS WITH '-513' return p"
            }
          ]
        },
        {
          "name": "Servers Domain Users can RDP to",
          "category": "RDP & remote exec",
          "queryList": [
            {
              "final": true,
              "query": "match p=(g:Group)-[:CanRDP]->(c:Computer) where g.name STARTS WITH 'DOMAIN USERS' AND c.operatingsystem CONTAINS 'Server' return p"
            }
          ]
        },
        {
          "name": "What groups can RDP",
          "category": "RDP & remote exec",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(m:Group)-[r:CanRDP]->(n:Computer) RETURN p"
            }
          ]
        },
        {
          "name": "Azure users in Global Administrator role",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p =(n)-[r:AZGlobalAdmin*1..]->(m) RETURN p"
            }
          ]
        },
        {
          "name": "On-prem users with edges into Azure",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(m:User)-[r:AZResetPassword|AZOwns|AZUserAccessAdministrator|AZContributor|AZAddMembers|AZGlobalAdmin|AZVMContributor|AZAvereContributor]->(n) WHERE m.objectid CONTAINS 'S-1-5-21' RETURN p"
            }
          ]
        },
        {
          "name": "All paths to an Azure VM",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p = (n)-[r]->(g:AZVM) RETURN p"
            }
          ]
        },
        {
          "name": "All paths to an Azure KeyVault",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p = (n)-[r]->(g:AZKeyVault) RETURN p"
            }
          ]
        },
        {
          "name": "All Azure users and their groups",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=(m:AZUser)-[r:MemberOf]->(n) WHERE NOT m.objectid CONTAINS 'S-1-5' RETURN p"
            }
          ]
        },
        {
          "name": "Azure AD groups synchronised from on-prem",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:Group) WHERE n.objectid CONTAINS 'S-1-5' AND n.azsyncid IS NOT NULL RETURN n"
            }
          ]
        },
        {
          "name": "All privileged service principals",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p = (g:AZServicePrincipal)-[r]->(n) RETURN p"
            }
          ]
        },
        {
          "name": "Owners of Azure applications",
          "category": "Azure / Entra",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p = (n)-[r:AZOwns]->(g:AZApp) RETURN p"
            }
          ]
        },
        {
          "name": "All certificate templates",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Certificate Template' RETURN n"
            }
          ]
        },
        {
          "name": "Enabled certificate templates",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Certificate Template' and n.Enabled = true RETURN n"
            }
          ]
        },
        {
          "name": "Certificate authorities",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Enrollment Service' RETURN n"
            }
          ]
        },
        {
          "name": "ESC1 misconfigured templates",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Certificate Template' and n.`Enrollee Supplies Subject` = true and n.`Client Authentication` = true and n.`Enabled` = true  RETURN n"
            }
          ]
        },
        {
          "name": "ESC2 misconfigured templates",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Certificate Template' and n.`Enabled` = true and (n.`Extended Key Usage` = [] or 'Any Purpose' IN n.`Extended Key Usage`)  RETURN n"
            }
          ]
        },
        {
          "name": "ESC3 enrollment agent templates",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Certificate Template' and n.`Enabled` = true and (n.`Extended Key Usage` = [] or 'Any Purpose' IN n.`Extended Key Usage` or 'Certificate Request Agent' IN n.`Extended Key Usage`)  RETURN n"
            }
          ]
        },
        {
          "name": "ESC4 vulnerable template access control",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=shortestPath((g)-[:GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner*1..]->(n:GPO)) WHERE  g<>n and n.type = 'Certificate Template' and n.`Enabled` = true RETURN p"
            }
          ]
        },
        {
          "name": "ESC6 CAs with user-specified SAN",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Enrollment Service' and n.`User Specified SAN` = 'Enabled' RETURN n"
            }
          ]
        },
        {
          "name": "ESC7 vulnerable CA access control",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=shortestPath((g)-[r:GenericAll|GenericWrite|Owns|WriteDacl|WriteOwner|ManageCa|ManageCertificates*1..]->(n:GPO)) WHERE  g<>n and n.type = 'Enrollment Service' RETURN p"
            }
          ]
        },
        {
          "name": "ESC8 CAs with HTTP web enrollment",
          "category": "AD CS escalation",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:GPO) WHERE n.type = 'Enrollment Service' and n.`Web Enrollment` = 'Enabled' RETURN n"
            }
          ]
        },
        {
          "name": "Cracked users who can RDP somewhere",
          "category": "Post-crack plaintext",
          "queryList": [
            {
              "final": true,
              "query": "match (u1:User) WHERE u1.plaintext=True MATCH p1=(u1)-[:CanRDP*1..]->(c:Computer) RETURN u1"
            }
          ]
        },
        {
          "name": "Cracked users in high value groups",
          "category": "Post-crack plaintext",
          "queryList": [
            {
              "final": true,
              "query": "match (u1:User) WHERE u1.plaintext=True MATCH p=(u1:User)-[r:MemberOf*1..]->(m:Group {highvalue:true}) RETURN u1"
            }
          ]
        },
        {
          "name": "Cracked kerberoastable users",
          "category": "Post-crack plaintext",
          "queryList": [
            {
              "final": true,
              "query": "match (u1:User) WHERE u1.plaintext=True AND u1.hasspn=True RETURN u1"
            }
          ]
        },
        {
          "name": "Season passwords + high value",
          "category": "Post-crack plaintext",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u1:User) WHERE u1.plaintextpassword =~ \"([Ww]inter.*|[sS]pring.*|[sS]ummer.*|[fF]all.*)\" MATCH p=(u1:User)-[r:MemberOf*1..]->(m:Group {highvalue:true}) RETURN u1"
            }
          ]
        },
        {
          "name": "Season passwords + local admin",
          "category": "Post-crack plaintext",
          "queryList": [
            {
              "final": true,
              "query": "match (u1:User) WHERE u1.plaintextpassword =~ \"([Ww]inter.*|[sS]pring.*|[sS]ummer.*|[fF]all.*)\" match p=(u1:User)-[r:AdminTo]->(n:Computer) RETURN p"
            }
          ]
        },
        {
          "name": "'password' variants + high value",
          "category": "Post-crack plaintext",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (u1:User) WHERE u1.plaintextpassword =~ \"(.*[pP][aA@][sS$][sS$][wW][oO0][rR][dD].*)\" MATCH p=(u1:User)-[r:MemberOf*1..]->(m:Group {highvalue:true}) RETURN u1"
            }
          ]
        },
        {
          "name": "All relationships added by GPO",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p=()-[r]-() WHERE r.gpohound = true RETURN p"
            }
          ]
        },
        {
          "name": "GPO-granted local administrators",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p1=()-[r:AdminTo]->() WHERE r.gpohound = true WITH p1 OPTIONAL MATCH p2=()-[r1:MemberOf*1..]->()-[r2:AdminTo]->() WHERE r2.gpohound = true RETURN p1,p2"
            }
          ]
        },
        {
          "name": "GPO-granted Remote Desktop Users",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p1=()-[r:CanRDP]->() WHERE r.gpohound = true WITH p1 OPTIONAL MATCH p2=()-[r1:MemberOf*1..]->()-[r2:CanRDP]->() WHERE r2.gpohound = true RETURN p1,p2"
            }
          ]
        },
        {
          "name": "GPO-granted Distributed COM Users",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p1=()-[r:ExecuteDCOM]->() WHERE r.gpohound = true WITH p1 OPTIONAL MATCH p2=()-[r1:MemberOf*1..]->()-[r2:ExecuteDCOM]->() WHERE r2.gpohound = true RETURN p1,p2"
            }
          ]
        },
        {
          "name": "GPO-granted Remote Management Users",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p1=()-[r:CanPSRemote]->() WHERE r.gpohound = true WITH p1 OPTIONAL MATCH p2=()-[r1:MemberOf*1..]->()-[r2:CanPSRemote]->() WHERE r2.gpohound = true RETURN p1,p2"
            }
          ]
        },
        {
          "name": "GPO-granted local privilege escalation",
          "category": "GPO-derived edges",
          "queryList": [
            {
              "final": true,
              "query": "MATCH p1=()-[r:CanPrivEsc]->() WHERE r.gpohound = true WITH p1 OPTIONAL MATCH p2=()-[r1:MemberOf*1..]->()-[r2:CanPrivEsc]->() WHERE r2.gpohound = true RETURN p1,p2"
            }
          ]
        },
        {
          "name": "Computers where SMB signing is not required",
          "category": "Host hygiene",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:Computer) WHERE n.smbSigningRequired = False RETURN n"
            }
          ]
        },
        {
          "name": "Computers where SMB signing is not enabled",
          "category": "Host hygiene",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:Computer) WHERE n.smbSigningEnabled = False RETURN n"
            }
          ]
        },
        {
          "name": "Computers where NTLMv1 is supported",
          "category": "Host hygiene",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:Computer) WHERE n.NTLMv1Support = True RETURN n"
            }
          ]
        },
        {
          "name": "Computers with VNC credentials",
          "category": "Host hygiene",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (n:Computer) WHERE ANY(k IN keys(n) WHERE toLower(k) CONTAINS 'vnc' and toLower(k) CONTAINS 'pass') RETURN n"
            }
          ]
        },
        {
          "name": "Legacy OS still on the network",
          "category": "Hygiene & stale objects",
          "queryList": [
            {
              "final": true,
              "query": "MATCH (c:Computer) WHERE c.operatingsystem =~ '(?i).*(XP|2000|2003|2008|Vista|Windows 7).*' RETURN c"
            }
          ]
        }
      ]
    }
    ```

## :material-link-variant: Related

- Consumes creds from [Password Spraying](password-spraying.md); paths lead to [Active Directory](active-directory.md) / [Kerberos](kerberos.md) / [AD CS](adcs.md).
- Reference: [BloodHound docs](https://bloodhound.specterops.io/).
