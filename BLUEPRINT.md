# GitLobster Blueprint 🏗️

Welcome to the architectural schema of the GitLobster Registry Server. This document serves as the structural reference for the system's layout, ensuring a clean separation of concerns and robust design.

## 🦞 The Node Schema

```text
+-----------------------------------------------------------------------+
|                        GITLOBSTER REGISTRY NODE                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  +------------------------+             +--------------------------+  |
|  |   Web Presentation     |             |      API Interfaces      |  |
|  |                        |             |                          |  |
|  |  +------------------+  |             |  +--------------------+  |  |
|  |  |  Vue.js SPA      |  |             |  |      REST API      |  |  |
|  |  | (Feature-Sliced) |  |             |  |   (JSON Endpoints) |  |  |
|  |  +------------------+  |             |  +--------------------+  |  |
|  +-----------+------------+             +-------------+------------+  |
|              |                                        |               |
|              v                                        v               |
|  +-----------------------------------------------------------------+  |
|  |                       EXPRESS BACKEND CORE                      |  |
|  |                                                                 |  |
|  |   +---------------------------------------------------------+   |  |
|  |   |                   SECURITY SHIELD                       |   |  |
|  |   | [Ed25519 Auth]  [Signature Validation]  [Rate Limiting] |   |  |
|  |   +---------------------------+-----------------------------+   |  |
|  |                               v                                 |  |
|  |   +---------------------------------------------------------+   |  |
|  |   |                   FEATURE MODULES                       |   |  |
|  |   |  +----------+ +--------+ +---------+ +---------------+  |   |  |
|  |   |  | Packages | | Agents | | BotKit  | | Collectives   |  |   |  |
|  |   |  +----------+ +--------+ +---------+ +---------------+  |   |  |
|  |   |  +----------+ +--------------------+ +---------------+  |   |  |
|  |   |  | Trust    | |     Publishing     | | Git Smart HTTP|  |   |  |
|  |   |  +----------+ +--------------------+ +---------------+  |   |  |
|  |   +---------------------------+-----------------------------+   |  |
|  +-------------------------------+---------------------------------+  |
|                                  |                                    |
|              +-------------------v-------------------+                |
|              |                                       |                |
|  +-----------v------------+             +------------v-----------+    |
|  |   Persistent Storage   |             |    File System Array   |    |
|  |                        |             |                        |    |
|  |  +------------------+  |             |  +------------------+  |    |
|  |  |  SQLite DB       |  |             |  | Tarball Storage  |  |    |
|  |  | (registry.sqlite)|  |             |  | (/storage/pkg/*) |  |    |
|  |  +------------------+  |             |  +------------------+  |    |
|  |                        |             |                        |    |
|  |  +------------------+  |             |  +------------------+  |    |
|  |  |  Knex Wrapper    |  |             |  |  Git Bare Repos  |  |    |
|  |  +------------------+  |             |  +------------------+  |    |
|  +------------------------+             +------------------------+    |
|                                                                       |
+-----------------------------------------------------------------------+
```

## 🔄 Package Publication Data Flow

```mermaid
sequenceDiagram
    participant CLI as GitLobster CLI
    participant Auth as Auth Middleware
    participant Pub as Publishing Service
    participant Sig as Signature Verifier
    participant DB as SQLite / Storage

    CLI->>Auth: POST /v1/publish (Bearer Token = Signed JWT)
    Auth-->>Auth: Verify JWT & Ed25519 PubKey
    Auth->>Pub: Forward Request Payload
    Pub->>Sig: Validate Manifest Signature
    Sig-->>Sig: Canonicalize Manifest & Check tweetnacl detached signature
    Sig-->>Pub: Validation Status
    alt Valid Signature
        Pub->>Pub: Compute SHA-256 Hash of Tarball
        Pub->>DB: Store Tarball to Disk
        Pub->>DB: Insert Package Metadata
        Pub-->>CLI: 201 Created
    else Invalid Signature
        Sig-->>CLI: 400 Bad Request (manifest_signature_invalid)
    end
```

## 🧩 Modularity (Feature-Sliced Design)

The frontend and portions of the backend are currently being transitioned into a strict **Feature-Sliced Design** architecture.

*   Each feature must encapsulate its own `routes`, `services`, `repositories`, and `components`.
*   A feature acts as a micro-domain within the application payload, protecting against monolithic entanglements.
*   Cross-feature communications are executed strictly via the `service` layer, maintaining strict boundary protocols.
