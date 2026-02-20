# QuickRefurbz API Reference v1.4.1

Base URL: `https://<server>:3004/api`
Auth: JWT Bearer token in `Authorization: Bearer <token>` header
Content-Type: `application/json` (unless noted)

All responses follow the standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-02-20T00:00:00.000Z",
    "duration": 42,
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 200,
      "totalPages": 4,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Item not found: QLID000000099"
  }
}
```

---

## Table of Contents

1. [Authentication](#authentication)
2. [Admin / Users](#admin--users)
3. [Dashboard](#dashboard)
4. [Pallets](#pallets)
5. [Sourcing](#sourcing)
6. [Intake & Identification](#intake--identification)
7. [Items](#items)
8. [Tickets](#tickets)
9. [Parts](#parts)
10. [Photos](#photos)
11. [Grading](#grading)
12. [Costs](#costs)
13. [Data Wipe](#data-wipe)
14. [Certificates (Data Wipe)](#certificates-data-wipe)
15. [Labels & Printing](#labels--printing)
16. [Printers](#printers)
17. [Workflow Jobs](#workflow-jobs)
18. [Workflow SOPs](#workflow-sops)
19. [Workflow Metadata](#workflow-metadata)
20. [Diagnostics Tests](#diagnostics-tests)
21. [Diagnostic Sessions](#diagnostic-sessions)
22. [Certifications (Refurb)](#certifications-refurb)
23. [External Checks](#external-checks)
24. [Technicians](#technicians)
25. [Settings](#settings)
26. [UPC Lookup](#upc-lookup)
27. [Feed (Product Export)](#feed-product-export)
28. [Exports](#exports)
29. [Webhooks](#webhooks)
30. [Monitoring](#monitoring)
31. [Sessions (Work)](#sessions-work)
32. [Stations](#stations)
33. [AI](#ai)
34. [Health](#health)
35. [Kanban](#kanban)
36. [Enums & Reference Values](#enums--reference-values)

---

## Authentication

### POST /api/auth/login

Login with email and password. Returns a JWT token.

| Field | Value |
|-------|-------|
| **Auth** | None |
| **Content-Type** | application/json |

**Request Body:**

```json
{
  "email": "connor@quicklotz.com",
  "password": "s3cur3"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "connor@quicklotz.com",
    "name": "Connor",
    "role": "admin",
    "is_active": true
  }
}
```

---

### GET /api/auth/me

Get the currently authenticated user profile.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "email": "connor@quicklotz.com",
    "name": "Connor",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-01-15T00:00:00.000Z"
  }
}
```

---

### GET /api/auth/verify-token

Verify an invite or password-reset token.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | The token to verify |
| `type` | string | Yes | `invite` or `reset` |

**Response:**

```json
{
  "valid": true,
  "email": "sam@quicklotz.com",
  "name": "Sam",
  "type": "invite"
}
```

---

### POST /api/auth/accept-invite

Accept an invitation and set a password.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Request Body:**

```json
{
  "token": "abc123...",
  "password": "newP@ssw0rd"
}
```

**Response:** User object (same shape as `/api/auth/me`)

---

### POST /api/auth/forgot-password

Request a password reset email.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Request Body:**

```json
{
  "email": "connor@quicklotz.com"
}
```

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/auth/reset-password

Reset password using a token from the email.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Request Body:**

```json
{
  "token": "abc123...",
  "password": "newP@ssw0rd"
}
```

**Response:**

```json
{
  "success": true
}
```

---

## Admin / Users

### GET /api/admin/users

List all users. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max results |

**Response:**

```json
[
  {
    "id": "uuid",
    "email": "connor@quicklotz.com",
    "name": "Connor",
    "role": "admin",
    "is_active": true,
    "created_at": "2026-01-15T00:00:00.000Z"
  }
]
```

---

### POST /api/auth/invite

Create and invite a new user. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Request Body:**

```json
{
  "email": "sam@quicklotz.com",
  "name": "Sam",
  "role": "technician"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email |
| `name` | string | Yes | Display name |
| `role` | string | No | `admin`, `manager`, or `technician` (default: `technician`) |

**Response:** User object

---

### PUT /api/admin/users/:id

Update a user. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Request Body:**

```json
{
  "name": "Samuel",
  "role": "manager",
  "is_active": true
}
```

**Response:** Updated user object

---

### DELETE /api/admin/users/:id

Deactivate a user (soft-delete). Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/admin/users/:id/resend-invite

Resend the invite email. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/admin/seed-stations

Seed 10 station accounts (station01 through station10). Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `force` | boolean | false | Reset existing station passwords if true |

**Response:**

```json
{
  "created": 10,
  "skipped": 0,
  "reset": 0
}
```

---

### GET /api/admin/stations

Get all station account statuses. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
[
  {
    "id": "uuid",
    "email": "station01@quickrefurbz.local",
    "name": "Station 01",
    "role": "station",
    "is_active": true,
    "last_heartbeat": "2026-02-20T12:00:00.000Z",
    "current_page": "/workflow"
  }
]
```

---

### GET /api/admin/stations/:id/activity

Get activity log for a station. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max results |

**Response:**

```json
[
  {
    "id": "uuid",
    "action": "ITEM_SCANNED",
    "qlid": "QLID000000001",
    "timestamp": "2026-02-20T12:00:00.000Z",
    "details": {}
  }
]
```

---

## Dashboard

### GET /api/dashboard

Get overall dashboard statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "total": 1500,
  "byStage": {
    "INTAKE": 120,
    "TESTING": 85,
    "REPAIR": 42,
    "CLEANING": 30,
    "FINAL_QC": 18,
    "COMPLETE": 1205
  },
  "byCategory": {
    "LAPTOP": 300,
    "PHONE": 250,
    "TABLET": 180
  },
  "byPriority": {
    "LOW": 200,
    "NORMAL": 1100,
    "HIGH": 150,
    "URGENT": 50
  },
  "byPallet": {
    "P1BBY": 45,
    "P2TGT": 30
  },
  "todayReceived": 25,
  "todayCompleted": 18,
  "palletCount": 42,
  "technicianCount": 8,
  "openTickets": 12
}
```

---

## Pallets

### POST /api/pallets/generate-rfb-id

Generate a new pallet ID in the QR{7-digit} format.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "retailer": "BESTBUY"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `retailer` | Retailer | No | Original retailer. Defaults to `OTHER` |

**Response:**

```json
{
  "palletId": "QR0000001"
}
```

---

### GET /api/pallets

List pallets with optional filters.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | PalletStatus | Filter by status |
| `retailer` | Retailer | Filter by retailer |
| `source` | LiquidationSource | Filter by source |
| `limit` | number | Max results |

**Response:**

```json
[
  {
    "id": "uuid",
    "palletId": "QR0000001",
    "retailer": "BESTBUY",
    "liquidationSource": "QUICKLOTZ",
    "sourcePalletId": "PTRF70336",
    "sourceOrderId": "INV-2026-001",
    "status": "IN_PROGRESS",
    "expectedItems": 50,
    "receivedItems": 35,
    "completedItems": 20,
    "totalCogs": 2500.00,
    "warehouseId": "WH-001",
    "receivedAt": "2026-02-15T00:00:00.000Z",
    "createdAt": "2026-02-15T00:00:00.000Z",
    "updatedAt": "2026-02-20T12:00:00.000Z"
  }
]
```

---

### GET /api/pallets/:id

Get a single pallet with its items.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "pallet": { /* Pallet object */ },
  "items": [ /* RefurbItem[] */ ]
}
```

---

### POST /api/pallets

Create a new pallet.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "retailer": "BESTBUY",
  "liquidationSource": "QUICKLOTZ",
  "sourcePalletId": "PTRF70336",
  "sourceOrderId": "INV-2026-001",
  "expectedItems": 50,
  "totalCogs": 2500.00,
  "warehouseId": "WH-001",
  "notes": "Mixed electronics pallet"
}
```

**Response:** Pallet object

---

### PUT /api/pallets/:id

Update a pallet.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:** Partial pallet fields

**Response:** Updated pallet object

---

### DELETE /api/pallets/:id

Delete a pallet. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/pallets/from-sourcing

Create a pallet from sourcing data (auto-imports from TechLiquidators / QuickLotz sourcing DB).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "sourcingPalletId": "PTRF70336",
  "sourcingOrderId": "INV-2026-001"
}
```

**Response:**

```json
{
  "pallet": { /* Pallet object */ },
  "sourcingContext": {
    "lineItems": 50,
    "totalMsrp": 15000.00,
    "categories": ["LAPTOP", "TABLET", "PHONE"]
  }
}
```

---

### POST /api/supervisor/pallet-action

Supervisor action: rename or reprint a pallet label.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "action": "rename",
  "palletId": "QR0000001",
  "newName": "QR0000001-A"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | `rename` or `reprint` |
| `palletId` | string | Yes | Pallet ID |
| `newName` | string | No | New name (for rename action) |

**Response:** Updated pallet object

---

## Sourcing

### GET /api/sourcing/pallet/:palletId

Look up a pallet in the sourcing database (reads from TechLiquidators sourcing DB).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "pallet": {
    "palletId": "PTRF70336",
    "orderId": "INV-2026-001",
    "retailer": "BESTBUY",
    "itemCount": 50,
    "totalMsrp": 15000.00
  },
  "lineItems": [
    {
      "upc": "887276678900",
      "manufacturer": "Samsung",
      "model": "QN55Q60C",
      "category": "TV",
      "msrp": 549.99,
      "quantity": 1
    }
  ]
}
```

---

### GET /api/sourcing/order/:orderId

Look up pallets by order ID.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "pallets": [ /* sourcing pallet objects */ ]
}
```

---

### GET /api/health/sourcing

Check sourcing database connectivity.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "status": "ok",
  "latencyMs": 12
}
```

---

## Intake & Identification

### POST /api/intake/identify/barcode

Identify a product by scanning its UPC / EAN barcode.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "barcode": "887276678900"
}
```

**Response:**

```json
{
  "upc": "887276678900",
  "manufacturer": "Samsung",
  "model": "QN55Q60C",
  "category": "TV",
  "msrp": 549.99,
  "title": "Samsung 55\" QLED 4K Smart TV",
  "source": "upc_database",
  "confidence": 0.98
}
```

---

### POST /api/intake/identify/search

Free-text product search.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "query": "Samsung QN55Q60C"
}
```

**Response:**

```json
{
  "results": [
    {
      "manufacturer": "Samsung",
      "model": "QN55Q60C",
      "category": "TV",
      "msrp": 549.99,
      "upc": "887276678900",
      "score": 0.95
    }
  ]
}
```

---

### POST /api/intake/identify/label-photo

Identify a product from a photo of its label. Multipart form upload.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Content-Type** | multipart/form-data |

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `photo` | file | Yes | Image of product label (JPG/PNG) |

**Response:**

```json
{
  "manufacturer": "Samsung",
  "model": "QN55Q60C",
  "category": "TV",
  "msrp": 549.99,
  "upc": "887276678900",
  "serialNumber": "ABC123",
  "confidence": 0.85,
  "source": "label_ocr"
}
```

---

### POST /api/intake/identify/product-photo

Identify a product from a photo of the product itself (uses AI vision).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Content-Type** | multipart/form-data |

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `photo` | file | Yes | Image of the product (JPG/PNG) |

**Response:** Same shape as label-photo response.

---

### POST /api/qlid/reserve

Reserve a new QLID for an item being intaked.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "palletId": "P1BBY"
}
```

**Response:**

```json
{
  "qlid": "QLID000000042",
  "tick": 42,
  "barcodeValue": "RFB-P1BBY-QLID000000042"
}
```

---

## Items

### GET /api/items

List items with filters.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `palletId` | string | Filter by pallet ID |
| `stage` | RefurbStage | Filter by stage |
| `category` | ProductCategory | Filter by category |
| `grade` | FinalGrade | Filter by grade |
| `technicianId` | string | Filter by assigned tech |
| `priority` | JobPriority | Filter by priority |
| `limit` | number | Max results |

**Response:**

```json
[
  {
    "id": "uuid",
    "qlidTick": 1,
    "qlid": "QLID000000001",
    "qrPalletId": "QR0000001",
    "palletId": "P1BBY",
    "barcodeValue": "RFB-P1BBY-QLID000000001",
    "intakeEmployeeId": "EMP001",
    "warehouseId": "WH-001",
    "intakeTs": "2026-02-15T10:00:00.000Z",
    "manufacturer": "Samsung",
    "model": "QN55Q60C",
    "category": "TV",
    "upc": "887276678900",
    "serialNumber": "ABC123",
    "currentStage": "TESTING",
    "priority": "NORMAL",
    "assignedTechnicianId": "uuid",
    "finalGrade": null,
    "estimatedValue": null,
    "createdAt": "2026-02-15T10:00:00.000Z",
    "updatedAt": "2026-02-18T14:00:00.000Z"
  }
]
```

---

### GET /api/items/:id

Get a single item with its stage history.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "item": { /* RefurbItem */ },
  "history": [
    {
      "id": "uuid",
      "qlid": "QLID000000001",
      "fromStage": null,
      "toStage": "INTAKE",
      "technicianId": null,
      "technicianName": null,
      "durationMinutes": 0,
      "notes": "Received into QuickRefurbz",
      "createdAt": "2026-02-15T10:00:00.000Z"
    }
  ]
}
```

---

### POST /api/items/scan

Scan a barcode to look up an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "barcode": "RFB-P1BBY-QLID000000001",
  "warehouseId": "WH-001"
}
```

**Response:**

```json
{
  "item": { /* RefurbItem */ },
  "isNew": false,
  "source": "existing",
  "isRfbOrigin": true
}
```

---

### POST /api/items

Create a new item (full intake).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "palletId": "P1BBY",
  "manufacturer": "Samsung",
  "model": "QN55Q60C",
  "category": "TV",
  "upc": "887276678900",
  "serialNumber": "ABC123",
  "priority": "NORMAL",
  "employeeId": "EMP001",
  "warehouseId": "WH-001",
  "msrp": 549.99,
  "identificationMethod": "barcode",
  "condition": "Sealed box, minor dent on corner"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `palletId` | string | Yes | Internal pallet ID (P1BBY format) |
| `manufacturer` | string | No | Brand name |
| `model` | string | No | Model number |
| `category` | ProductCategory | Yes | Product category |
| `upc` | string | No | UPC barcode |
| `asin` | string | No | Amazon ASIN |
| `serialNumber` | string | No | Serial number |
| `priority` | JobPriority | No | Default: `NORMAL` |
| `notes` | string | No | Intake notes |
| `condition` | string | No | Initial condition notes |
| `employeeId` | string | Yes | Employee performing intake |
| `warehouseId` | string | Yes | Warehouse location |
| `msrp` | number | No | Manufacturer suggested retail price |
| `identificationMethod` | string | No | `barcode`, `manual`, `label-photo`, `product-photo` |

**Response:**

```json
{
  "item": { /* RefurbItem */ },
  "labelData": {
    "barcodeValue": "RFB-P1BBY-QLID000000001",
    "qlid": "QLID000000001",
    "palletId": "P1BBY",
    "employeeId": "EMP001",
    "warehouseId": "WH-001",
    "timestamp": "2026-02-20T12:00:00.000Z",
    "manufacturer": "Samsung",
    "model": "QN55Q60C"
  }
}
```

---

### PUT /api/items/:qlid

Update an item by its QLID.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "manufacturer": "Samsung",
  "model": "QN55Q60CAFXZA",
  "category": "TV",
  "upc": "887276678900",
  "serialNumber": "ABC123DEF",
  "msrp": 549.99,
  "conditionGrade": "B",
  "refurbChecklist": { "screen_ok": true, "power_ok": true }
}
```

**Response:** Updated RefurbItem

---

### POST /api/items/:id/advance

Advance item to next stage in the pipeline.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "technicianId": "uuid",
  "notes": "All tests passed",
  "finalGrade": "A",
  "estimatedValue": 399.99
}
```

**Response:** Updated RefurbItem

---

### POST /api/items/:id/stage

Set item to a specific stage (skip forward or send back).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "stage": "REPAIR",
  "data": {
    "technicianId": "uuid",
    "notes": "Needs screen replacement"
  }
}
```

**Response:** Updated RefurbItem

---

### POST /api/items/:id/assign

Assign a technician to an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "technicianId": "uuid"
}
```

**Response:** Updated RefurbItem

---

### DELETE /api/items/:id

Delete an item and its stage history. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
{
  "success": true
}
```

---

## Tickets

### GET /api/tickets

List repair tickets with filters.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | TicketStatus | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CANNOT_REPAIR` |
| `qlid` | string | Filter by item QLID |
| `technicianId` | string | Filter by assigned tech |
| `severity` | IssueSeverity | `CRITICAL`, `MAJOR`, `MINOR`, `COSMETIC` |
| `limit` | number | Max results |

**Response:**

```json
[
  {
    "id": "uuid",
    "ticketNumber": "TK0000001",
    "qlid": "QLID000000001",
    "issueType": "SCREEN_DAMAGE",
    "issueDescription": "Cracked display panel",
    "severity": "MAJOR",
    "status": "OPEN",
    "createdByTechnicianId": "uuid",
    "createdAt": "2026-02-18T14:00:00.000Z"
  }
]
```

---

### GET /api/tickets/:id

Get a single ticket.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Full RepairTicket object

---

### POST /api/tickets

Create a new repair ticket.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "issue": "Cracked display panel - visible crack from top-left corner",
  "severity": "MAJOR"
}
```

**Response:** Created RepairTicket object

---

### POST /api/tickets/:id/resolve

Resolve a ticket.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "resolution": "Replaced screen with OEM panel. Tested OK."
}
```

**Response:** Updated RepairTicket with `status: "RESOLVED"`

---

## Parts

### GET /api/parts

List parts inventory.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `category` | PartCategory | Filter by part category |
| `lowStock` | boolean | If true, only parts at or below reorder point |

**Response:**

```json
[
  {
    "id": "uuid",
    "partNumber": "SCR-SAM-55Q60",
    "name": "Samsung 55\" QLED Panel",
    "category": "SCREEN",
    "quantityOnHand": 3,
    "quantityReserved": 1,
    "reorderPoint": 2,
    "reorderQuantity": 5,
    "unitCost": 89.99,
    "location": "Shelf A-3",
    "compatibleCategories": ["TV"],
    "compatibleManufacturers": ["Samsung"],
    "createdAt": "2026-01-20T00:00:00.000Z"
  }
]
```

---

### POST /api/parts

Add a new part to inventory.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "partNumber": "SCR-SAM-55Q60",
  "name": "Samsung 55\" QLED Panel",
  "category": "SCREEN",
  "unitCost": 89.99,
  "quantityOnHand": 5,
  "reorderPoint": 2,
  "reorderQuantity": 5,
  "compatibleCategories": ["TV"],
  "compatibleManufacturers": ["Samsung"],
  "location": "Shelf A-3"
}
```

**Response:** Created Part object

---

### GET /api/parts/categories

List all part categories.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
["SCREEN", "BATTERY", "CABLE", "CHARGER", "KEYBOARD", "MEMORY", "STORAGE", "FAN", "SPEAKER", "CAMERA", "OTHER"]
```

---

### GET /api/parts/suppliers

List parts suppliers.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "iFixit",
    "apiUrl": "https://api.ifixit.com",
    "apiKey": "***"
  }
]
```

---

### GET /api/parts/stats

Get parts inventory statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalParts": 150,
  "totalValue": 12500.00,
  "lowStockCount": 8,
  "outOfStockCount": 2,
  "byCategory": { "SCREEN": 25, "BATTERY": 40 }
}
```

---

### GET /api/parts/:id

Get a single part.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Full Part object

---

### PUT /api/parts/:id

Update a part.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:** Partial Part fields

**Response:** Updated Part object

---

### DELETE /api/parts/:id

Delete a part.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/parts/:id/adjust

Adjust part quantity (restock, consumption, correction).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "quantity": 10,
  "reason": "Restocked from iFixit order #12345"
}
```

**Response:** Updated Part object

---

### GET /api/parts/compatible/:category

Get parts compatible with a product category.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Part[] filtered to the given ProductCategory

---

### GET /api/items/:qlid/parts

Get parts used for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "id": "uuid",
    "qlid": "QLID000000001",
    "partId": "uuid",
    "partNumber": "SCR-SAM-55Q60",
    "partName": "Samsung 55\" QLED Panel",
    "quantity": 1,
    "unitCost": 89.99,
    "totalCost": 89.99,
    "usedByTechnicianId": "uuid",
    "usedByTechnicianName": "Sam",
    "createdAt": "2026-02-18T16:00:00.000Z"
  }
]
```

---

### POST /api/items/:qlid/parts

Record parts used for an item repair.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "parts": [
    { "partId": "uuid", "quantity": 1 }
  ],
  "ticketId": "uuid"
}
```

**Response:**

```json
{
  "usage": [ /* PartsUsage[] */ ],
  "totalCost": 89.99
}
```

---

### POST /api/parts/suppliers

Add a parts supplier.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "name": "iFixit",
  "apiUrl": "https://api.ifixit.com",
  "apiKey": "sk_..."
}
```

**Response:** Created supplier object

---

### POST /api/parts/sync/:supplierId

Sync parts catalog from a supplier API.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/parts/import

Bulk import parts. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Request Body:**

```json
{
  "parts": [
    {
      "partNumber": "BAT-APL-MBA-M2",
      "name": "MacBook Air M2 Battery",
      "category": "BATTERY",
      "unitCost": 45.00,
      "quantityOnHand": 10
    }
  ]
}
```

**Response:**

```json
{
  "imported": 1,
  "total": 1
}
```

---

## Photos

### POST /api/photos/:qlid

Upload photos for an item. Multipart form upload. Max 10 photos per request.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Content-Type** | multipart/form-data |

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `photos[]` | file[] | Yes | Up to 10 image files (JPG/PNG) |

**Response:**

```json
{
  "photos": [
    {
      "id": "uuid",
      "qlid": "QLID000000001",
      "url": "/api/photos/file/uuid",
      "filename": "front.jpg",
      "stage": "INTAKE",
      "caption": null,
      "createdAt": "2026-02-20T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### GET /api/photos/:qlid

Get photos for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `stage` | RefurbStage | Filter by stage when photo was taken |

**Response:** Photo[]

---

### GET /api/photos/file/:photoId

Get photo file binary. Returns the image directly.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Response Content-Type** | image/jpeg or image/png |

---

### GET /api/photos/:qlid/count

Get photo count for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "count": 5
}
```

---

### PATCH /api/photos/file/:photoId

Update a photo's caption.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "caption": "Front view - minor scratch on bezel"
}
```

**Response:** Updated photo object

---

### DELETE /api/photos/file/:photoId

Delete a photo.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/items/:qlid/photos

Upload photos for an item (alias route).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Content-Type** | multipart/form-data |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `stage` | RefurbStage | Stage when photo was taken |
| `photoType` | string | `BEFORE`, `AFTER`, `DEFECT`, `SERIAL` |

**Response:** Same as `POST /api/photos/:qlid`

---

### GET /api/items/:qlid/photos

Get photos for an item (alias route).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `stage` | RefurbStage | Filter by stage |

**Response:**

```json
{
  "photos": [ /* Photo[] */ ]
}
```

---

### DELETE /api/items/:qlid/photos/:photoId

Delete a photo (alias route).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "ok": true
}
```

---

## Grading

### GET /api/grading/rubric/:category

Get the grading rubric for a product category.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "category": "LAPTOP",
  "criteria": [
    {
      "name": "Screen Condition",
      "weight": 0.3,
      "levels": {
        "A": "No scratches or marks",
        "B": "Minor scratches, not visible when on",
        "C": "Visible scratches, does not affect usage",
        "D": "Significant marks, minor dead pixels"
      }
    }
  ]
}
```

---

### GET /api/grading/rubrics

Get all grading rubrics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Array of rubric objects (one per category)

---

### POST /api/grading/assess

Create a grading assessment for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "grade": "B",
  "notes": "Minor scratches on lid, fully functional"
}
```

**Response:** Assessment object

---

### GET /api/grading/assessment/:qlid

Get current assessment for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Assessment object

---

### GET /api/grading/history/:qlid

Get all assessments for an item (history).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Assessment[]

---

### GET /api/grading/stats

Get grading statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalAssessments": 500,
  "byGrade": { "NEW": 10, "A": 120, "B": 200, "C": 100, "D": 50, "SALVAGE": 20 },
  "averageGrade": "B",
  "todayAssessed": 15
}
```

---

## Costs

### POST /api/costs/labor

Record labor time for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "hours": 1.5,
  "rate": 22.00
}
```

**Response:** Labor entry object

---

### GET /api/costs/labor/:qlid

Get labor entries for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Labor entry[]

---

### POST /api/costs/calculate/:qlid

Calculate total costs for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "unitCogs": 50.00
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `unitCogs` | number | No | Override unit COGS from pallet |

**Response:** Cost breakdown object

---

### GET /api/costs/breakdown/:qlid

Get detailed cost breakdown for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "qlid": "QLID000000001",
  "unitCogs": 50.00,
  "partsCost": 89.99,
  "laborCost": 33.00,
  "overheadCost": 5.00,
  "totalCost": 177.99,
  "parts": [ /* PartsUsage[] */ ],
  "labor": [ /* LaborEntry[] */ ]
}
```

---

### GET /api/costs/summary/:qlid

Get cost summary for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "unitCogs": 50.00,
  "partsCost": 89.99,
  "laborCost": 33.00,
  "overheadCost": 5.00,
  "totalCost": 177.99,
  "estimatedValue": 399.99,
  "profitMargin": 0.555
}
```

---

### POST /api/costs/cogs/:qlid

Set unit COGS for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "unitCogs": 50.00
}
```

**Response:** Updated cost object

---

### POST /api/costs/value/:qlid

Set estimated value for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "estimatedValue": 399.99
}
```

**Response:** Updated cost object

---

### GET /api/costs/stats

Get overall cost statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalItems": 500,
  "totalCogs": 25000.00,
  "totalPartsCost": 8500.00,
  "totalLaborCost": 5200.00,
  "totalValue": 120000.00,
  "averageProfitMargin": 0.42,
  "averageCostPerUnit": 77.40
}
```

---

## Data Wipe

### GET /api/datawipe/reports

List data wipe reports.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `qlid` | string | Filter by item QLID |

**Response:** DataWipeReport[]

---

### GET /api/datawipe/reports/:qlid

Get data wipe report for an item. Public (no auth required).

| Field | Value |
|-------|-------|
| **Auth** | None |

**Response:**

```json
{
  "id": "uuid",
  "qlid": "QLID000000001",
  "deviceInfo": {
    "manufacturer": "Apple",
    "model": "MacBook Pro 14\"",
    "serialNumber": "C02X..."
  },
  "wipeMethod": "NIST_800_88",
  "status": "COMPLETE",
  "startedAt": "2026-02-18T14:00:00.000Z",
  "completedAt": "2026-02-18T14:45:00.000Z",
  "verificationMethod": "FULL_DISK_SCAN",
  "performedBy": "uuid"
}
```

---

### POST /api/datawipe/start

Start a data wipe session.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "deviceInfo": {
    "manufacturer": "Apple",
    "model": "MacBook Pro 14\"",
    "serialNumber": "C02X...",
    "storageType": "SSD",
    "storageCapacityGB": 512
  },
  "wipeMethod": "NIST_800_88",
  "notes": "Customer return - must wipe"
}
```

**Response:** DataWipeReport object with `status: "IN_PROGRESS"`

---

### POST /api/datawipe/:id/complete

Complete a data wipe and record verification.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "verificationMethod": "FULL_DISK_SCAN",
  "status": "COMPLETE"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `verificationMethod` | string | Yes | `FULL_DISK_SCAN`, `RANDOM_SAMPLE`, `HASH_VERIFY` |
| `status` | string | No | `COMPLETE` or `FAILED`. Default: `COMPLETE` |

**Response:** Updated DataWipeReport

---

### GET /api/datawipe/:qlid/certificate

Get data wipe certificate data. Public (no auth required).

| Field | Value |
|-------|-------|
| **Auth** | None |

**Response:**

```json
{
  "certificateNumber": "DW-20260218-0001",
  "qlid": "QLID000000001",
  "deviceInfo": { ... },
  "wipeMethod": "NIST_800_88",
  "wipeMethodDisplay": "NIST SP 800-88 Rev. 1 Clear",
  "verificationMethod": "FULL_DISK_SCAN",
  "completedAt": "2026-02-18T14:45:00.000Z",
  "performedByName": "Sam"
}
```

---

## Certificates (Data Wipe)

### POST /api/certificates

Create a data wipe certificate.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "deviceInfo": { ... },
  "wipeMethod": "NIST_800_88",
  "verificationMethod": "FULL_DISK_SCAN"
}
```

**Response:** Certificate object

---

### GET /api/certificates

List certificates.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max results |
| `wipeMethod` | string | Filter by wipe method |

**Response:** Certificate[]

---

### GET /api/certificates/stats/summary

Get certificate statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalCertificates": 200,
  "byMethod": { "NIST_800_88": 150, "DOD_5220_22_M": 50 },
  "thisMonth": 25,
  "thisWeek": 8
}
```

---

### GET /api/certificates/:identifier

Get a certificate by its certificate number or UUID. Public.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Response:** Certificate object

---

### GET /api/certificates/item/:qlid

Get certificate for a specific item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Certificate object

---

### POST /api/certificates/verify

Verify a certificate's authenticity.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Request Body:**

```json
{
  "certificateNumber": "DW-20260218-0001",
  "verificationCode": "abc123"
}
```

**Response:**

```json
{
  "valid": true,
  "certificate": { ... },
  "message": "Certificate verified successfully"
}
```

---

### GET /api/certificates/:identifier/text

Get certificate as plain text. Public.

| Field | Value |
|-------|-------|
| **Auth** | None |
| **Response Content-Type** | text/plain |

---

### GET /api/certificates/:identifier/content

Get certificate content for PDF rendering. Public.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Response:**

```json
{
  "certificate": { ... },
  "content": {
    "header": "Data Wipe Certificate",
    "sections": [ ... ]
  }
}
```

---

## Labels & Printing

### GET /api/labels/pallet/:palletId

Generate a pallet label.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `png` | `png` or `zpl` |
| `labelSize` | string | `4x6` | `2x1` or `4x6` |

**Response:** PNG image binary or ZPL text depending on `format`.

---

### POST /api/labels/print-zpl

Print a pallet label directly to a Zebra printer via ZPL.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "printerIp": "192.168.1.100",
  "palletId": "QR0000001",
  "labelSize": "4x6"
}
```

**Response:**

```json
{
  "success": true
}
```

---

### GET /api/labels/refurb/:qlid

Generate a refurbished item label with QSKU barcode.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `png` | `png` or `zpl` |
| `labelSize` | string | `2x1.5` | `1x3`, `2x1.5`, or `4x6` |

**Response:** PNG image binary or ZPL text.

---

### POST /api/labels/refurb/print-zpl

Print a refurb label directly to a Zebra printer.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "printerIp": "192.168.1.100",
  "qlid": "QLID000000001",
  "labelSize": "2x1.5"
}
```

**Response:**

```json
{
  "success": true,
  "qsku": "RFB-QLID000000001"
}
```

---

## Printers

### GET /api/printers/discover

Discover Zebra printers on the network via broadcast.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `subnet` | string | Subnet to scan (e.g., `192.168.1`) |

**Response:**

```json
{
  "printers": [
    {
      "ip": "192.168.1.100",
      "model": "ZD421",
      "serial": "D3J123456789",
      "status": "ready"
    }
  ]
}
```

---

### GET /api/printers/status/:ip

Get printer status by IP.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "ip": "192.168.1.100",
  "model": "ZD421",
  "status": "ready",
  "mediaLoaded": true,
  "labelsRemaining": 250,
  "ribbonRemaining": 80
}
```

---

### GET /api/printers/settings

Get saved printer configurations.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Intake Label Printer",
    "ip": "192.168.1.100",
    "isDefault": true
  }
]
```

---

### POST /api/printers/settings

Save a printer configuration.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "name": "Intake Label Printer",
  "ip": "192.168.1.100",
  "isDefault": true
}
```

**Response:** Saved printer object

---

### DELETE /api/printers/settings/:id

Delete a saved printer configuration.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "ok": true
}
```

---

### POST /api/printers/test

Send a test print to a printer.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "printer_ip": "192.168.1.100"
}
```

**Response:**

```json
{
  "ok": true
}
```

---

### GET /api/printers/label-size/:ip

Get the detected label size loaded in a printer.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "width": 2,
  "height": 1,
  "unit": "inches",
  "dpi": 203
}
```

---

### GET /api/printers/label-presets

Get available label size presets.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  { "name": "1x3 Intake", "width": 1, "height": 3 },
  { "name": "2x1 Standard", "width": 2, "height": 1 },
  { "name": "2x1.5 Refurb", "width": 2, "height": 1.5 },
  { "name": "4x6 Shipping", "width": 4, "height": 6 }
]
```

---

## Workflow Jobs

### POST /api/workflow/jobs

Create a workflow job for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "palletId": "P1BBY",
  "category": "LAPTOP",
  "priority": "HIGH"
}
```

**Response:** RefurbJob object with `currentState: "REFURBZ_QUEUED"`

---

### GET /api/workflow/jobs

List workflow jobs with filters.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `state` | RefurbState | Filter by current state |
| `technicianId` | string | Filter by assigned tech |
| `category` | ProductCategory | Filter by category |
| `priority` | JobPriority | Filter by priority |

**Response:** RefurbJob[]

---

### GET /api/workflow/jobs/:qlid

Get a workflow job by QLID.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** RefurbJob object

---

### GET /api/workflow/jobs/:qlid/prompt

Get the current workflow prompt (step) for an item. This is the primary endpoint for the station UI -- it returns everything the technician needs to see.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "job": { /* RefurbJob */ },
  "state": "REFURBZ_IN_PROGRESS",
  "stateName": "In Progress",
  "totalSteps": 5,
  "currentStepIndex": 2,
  "currentStep": {
    "id": "uuid",
    "code": "LAPTOP_BIOS_CHECK",
    "name": "BIOS Check",
    "type": "CHECKLIST",
    "prompt": "Verify BIOS settings and check for password locks.",
    "promptEs": "Verifique la configuracion del BIOS y compruebe si hay bloqueos de contrasena.",
    "helpText": "1. Power on the device\n2. Press F2/Del to enter BIOS\n3. Check for password lock\n4. Verify boot order",
    "helpTextEs": "1. Encienda el dispositivo\n2. Presione F2/Del para ingresar al BIOS\n3. Verifique el bloqueo de contrasena\n4. Verifique el orden de arranque",
    "required": true,
    "order": 2,
    "checklistItems": ["BIOS accessible", "No password lock", "Boot order correct"],
    "checklistItemsEs": ["BIOS accesible", "Sin bloqueo de contrasena", "Orden de arranque correcto"]
  },
  "completedSteps": [ /* StepCompletion[] */ ],
  "progress": {
    "statesCompleted": 2,
    "totalStates": 11,
    "overallPercent": 18
  },
  "canAdvance": true,
  "canBlock": true,
  "canEscalate": true,
  "canRetry": false
}
```

---

### POST /api/workflow/jobs/:qlid/steps/:stepCode/complete

Complete a workflow step.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "checklistResults": {
    "BIOS accessible": true,
    "No password lock": true,
    "Boot order correct": true
  },
  "inputValues": {},
  "measurements": {},
  "notes": "BIOS unlocked, no issues",
  "photoUrls": []
}
```

**Response:** Updated step result with next prompt

---

### POST /api/workflow/jobs/:qlid/transition

Trigger a state transition.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "action": "ADVANCE",
  "reason": "All steps complete",
  "notes": "Moving to next phase"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | TransitionAction | Yes | `ADVANCE`, `BLOCK`, `ESCALATE`, `FAIL`, `RESOLVE`, `RETRY` |
| `reason` | string | No | Reason for the transition |
| `notes` | string | No | Additional notes |

**Response:** Updated RefurbJob

---

### POST /api/workflow/jobs/:qlid/assign

Assign a technician to a job.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "technicianId": "uuid",
  "technicianName": "Sam"
}
```

**Response:** Updated RefurbJob

---

### POST /api/workflow/jobs/:qlid/diagnose

Add a diagnosis to a job.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "defectCode": "SCR001",
  "severity": "MAJOR",
  "measurements": { "brightness": 80 },
  "repairAction": "REPLACE",
  "partsRequired": [
    { "partId": "uuid", "quantity": 1 }
  ]
}
```

**Response:** JobDiagnosis object

---

### GET /api/workflow/jobs/:qlid/diagnoses

Get all diagnoses for a job.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** JobDiagnosis[]

---

### POST /api/workflow/jobs/:qlid/certify

Certify a completed job.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "finalGrade": "A",
  "warrantyEligible": true,
  "notes": "All tests passed, like-new condition"
}
```

**Response:** Updated RefurbJob with `currentState: "CERTIFIED"`

---

### GET /api/workflow/jobs/:qlid/history

Get the full audit trail for a job.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "id": "uuid",
    "jobId": "uuid",
    "action": "STATE_TRANSITION",
    "fromState": "REFURBZ_QUEUED",
    "toState": "REFURBZ_ASSIGNED",
    "performedBy": "uuid",
    "performedByName": "Connor",
    "notes": "Assigned to Sam",
    "timestamp": "2026-02-18T10:00:00.000Z"
  }
]
```

---

## Workflow SOPs

### GET /api/workflow/sops

List all SOPs (Standard Operating Procedures) by category.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "category": "LAPTOP",
    "name": "Laptop Refurbishment SOP",
    "stateCount": 11
  },
  {
    "category": "PHONE",
    "name": "Phone Refurbishment SOP",
    "stateCount": 11
  }
]
```

---

### GET /api/workflow/sops/:category

Get the full SOP for a category, including all states and their steps.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "name": "Laptop Refurbishment SOP",
  "states": {
    "REFURBZ_IN_PROGRESS": [
      {
        "id": "uuid",
        "code": "LAPTOP_VISUAL_INSPECTION",
        "name": "Visual Inspection",
        "type": "CHECKLIST",
        "prompt": "Inspect the laptop for physical damage",
        "promptEs": "Inspeccione la laptop en busca de danos fisicos",
        "required": true,
        "order": 1,
        "checklistItems": ["Screen intact", "Keyboard intact", "No liquid damage"],
        "checklistItemsEs": ["Pantalla intacta", "Teclado intacto", "Sin dano por liquido"]
      }
    ]
  }
}
```

---

## Workflow Metadata

### GET /api/workflow/defect-codes

Get defect codes with optional category filter.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `category` | ProductCategory | Filter by category |

**Response:**

```json
[
  {
    "id": "uuid",
    "code": "SCR001",
    "category": "LAPTOP",
    "component": "SCREEN",
    "severity": "MAJOR",
    "description": "Cracked or damaged display panel",
    "repairSop": "Replace screen assembly",
    "estimatedMinutes": 45
  }
]
```

---

### GET /api/workflow/defect-codes/:code

Get a single defect code.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** DefectCode object

---

### GET /api/workflow/stages

Get all stages and states with metadata.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "stages": ["INTAKE", "TESTING", "REPAIR", "CLEANING", "FINAL_QC", "COMPLETE"],
  "states": {
    "REFURBZ_QUEUED": { "name": "Queued", "type": "NORMAL", "order": 0 },
    "REFURBZ_ASSIGNED": { "name": "Assigned", "type": "NORMAL", "order": 1 },
    "REFURBZ_BLOCKED": { "name": "Blocked", "type": "ESCAPE" },
    "REFURBZ_COMPLETE": { "name": "Complete", "type": "TERMINAL" }
  },
  "allStates": [ /* ordered RefurbState[] */ ]
}
```

---

### GET /api/workflow/stats

Get workflow statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalJobs": 500,
  "activeJobs": 85,
  "completedJobs": 415,
  "byState": { "REFURBZ_QUEUED": 20, "REFURBZ_IN_PROGRESS": 45 },
  "byCategory": { "LAPTOP": 200, "PHONE": 150 },
  "averageCompletionHours": 4.2,
  "todayCompleted": 12
}
```

---

### GET /api/workflow/queue

Get queue overview (jobs grouped by state).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "REFURBZ_QUEUED": {
    "count": 20,
    "jobs": [ /* RefurbJob[] (limited preview) */ ]
  },
  "REFURBZ_IN_PROGRESS": {
    "count": 45,
    "jobs": [ /* RefurbJob[] */ ]
  }
}
```

---

## Diagnostics Tests

### GET /api/diagnostics/tests

Get diagnostic test definitions.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `category` | ProductCategory | Filter by category |

**Response:**

```json
[
  {
    "id": "uuid",
    "code": "SA-PWR-001",
    "name": "Power On Test",
    "category": "APPLIANCE_SMALL",
    "testType": "FUNCTIONAL",
    "description": "Verify device powers on and reaches operational state",
    "instructions": "1. Plug in device\n2. Press power button\n3. Wait 30 seconds",
    "passCriteria": "Device powers on within 10 seconds, indicator light illuminates",
    "isCritical": true,
    "displayOrder": 1
  }
]
```

---

### GET /api/diagnostics/tests/all

Get all test suites grouped by category.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "APPLIANCE_SMALL": {
    "category": "APPLIANCE_SMALL",
    "tests": [ /* DiagnosticTest[] */ ],
    "totalTests": 12,
    "criticalTests": 5
  },
  "VACUUM": { ... }
}
```

---

### GET /api/diagnostics/tests/:category

Get test suite for a specific category.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Test suite object for the category

---

## Diagnostic Sessions

### POST /api/diagnostics/sessions

Start a new diagnostic session.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "category": "LAPTOP",
  "jobId": "uuid"
}
```

**Response:** DiagnosticSession object

---

### GET /api/diagnostics/sessions

List diagnostic sessions.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `qlid` | string | Filter by item QLID |
| `category` | ProductCategory | Filter by category |
| `limit` | number | Max results |

**Response:** DiagnosticSession[]

---

### GET /api/diagnostics/sessions/:qlid

Get the most recent session for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "session": { /* DiagnosticSession */ },
  "results": [ /* TestResult[] */ ],
  "defects": [ /* Defect[] */ ]
}
```

---

### POST /api/diagnostics/sessions/:sessionNumber/tests

Record a test result within a session.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "testCode": "SA-PWR-001",
  "result": "PASS",
  "measurementValue": 120,
  "notes": "Powers on in 3 seconds"
}
```

**Response:** Test result object

---

### POST /api/diagnostics/sessions/:sessionNumber/complete

Complete a diagnostic session.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "notes": "All tests passed. Device in good condition."
}
```

**Response:** Completed session with overall result

---

### GET /api/diagnostics/technicians/stats

Get diagnostic stats for all technicians.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "technicians": [
    {
      "technicianId": "uuid",
      "name": "Sam",
      "sessionsCompleted": 45,
      "passRate": 0.88,
      "averageSessionMinutes": 22
    }
  ],
  "summary": {
    "totalSessions": 200,
    "overallPassRate": 0.85
  }
}
```

---

### GET /api/diagnostics/technicians/:technicianId/stats

Get diagnostic stats for a specific technician.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Technician stats object

---

## Certifications (Refurb)

### POST /api/certifications

Issue a refurbishment certification.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "category": "LAPTOP",
  "manufacturer": "Apple",
  "model": "MacBook Pro 14\" M3",
  "serialNumber": "C02X...",
  "certificationLevel": "EXCELLENT",
  "imei": null,
  "reportedStolen": false,
  "financialHold": false,
  "warrantyType": "UPSCALED",
  "warrantyStatus": "ACTIVE",
  "certifiedBy": "uuid",
  "certifiedByName": "Sam"
}
```

**Response:**

```json
{
  "success": true,
  "certification": {
    "id": "uuid",
    "certificationId": "UC-20260220-0001",
    "qlid": "QLID000000001",
    "category": "LAPTOP",
    "manufacturer": "Apple",
    "model": "MacBook Pro 14\" M3",
    "certificationLevel": "EXCELLENT",
    "reportedStolen": false,
    "financialHold": false,
    "certifiedAt": "2026-02-20T12:00:00.000Z",
    "isRevoked": false,
    "validUntil": "2026-05-21T12:00:00.000Z"
  },
  "reportUrl": "/api/certifications/UC-20260220-0001/report",
  "labelUrl": "/api/certifications/UC-20260220-0001/label",
  "qrCodeUrl": "https://cert.upscaled.com/r/UC-20260220-0001"
}
```

---

### GET /api/certifications

List certifications with filters.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `category` | ProductCategory | Filter by category |
| `level` | CertificationLevel | `EXCELLENT`, `GOOD`, `FAIR`, `NOT_CERTIFIED` |
| `fromDate` | string | ISO date (start of range) |
| `toDate` | string | ISO date (end of range) |
| `limit` | number | Max results |

**Response:** Certification[]

---

### GET /api/certifications/stats

Get certification statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalCertifications": 350,
  "byLevel": {
    "EXCELLENT": 100,
    "GOOD": 150,
    "FAIR": 80,
    "NOT_CERTIFIED": 20
  },
  "certificationRate": 0.943,
  "byCategory": {
    "LAPTOP": { "total": 120, "excellent": 40, "good": 50, "fair": 25, "notCertified": 5 }
  }
}
```

---

### GET /api/certifications/verify/:certificationId

Publicly verify a certification. No auth required.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Response:**

```json
{
  "valid": true,
  "certification": {
    "certificationId": "UC-20260220-0001",
    "certificationLevel": "EXCELLENT",
    "certificationLevelDisplay": "Certified Excellent",
    "manufacturer": "Apple",
    "model": "MacBook Pro 14\" M3",
    "certifiedAt": "2026-02-20T12:00:00.000Z",
    "isRevoked": false,
    "warrantyType": "UPSCALED",
    "warrantyStatus": "ACTIVE",
    "warrantyEndDate": "2026-05-21T12:00:00.000Z",
    "warrantyDaysRemaining": 89
  },
  "checks": [
    { "code": "STOLEN", "name": "Stolen Status", "passed": true },
    { "code": "FINANCIAL", "name": "Financial Status", "passed": true },
    { "code": "FUNCTIONAL", "name": "Functionality", "passed": true }
  ],
  "message": "This device has been certified by Upscaled."
}
```

---

### GET /api/certifications/:certificationId

Get full certification details.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Full Certification object

---

### GET /api/certifications/:certificationId/report

Get the device history report.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `json` | `pdf` or `json` |

**Response:** PDF binary or JSON DeviceHistoryReport.

---

### GET /api/certifications/:certificationId/label

Get the certification label image.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `png` | `png` or `buffer` |

**Response:** PNG image binary.

---

### POST /api/certifications/:certificationId/revoke

Revoke a certification.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "reason": "Device reported stolen after certification"
}
```

**Response:** Updated Certification with `isRevoked: true`

---

## External Checks

### POST /api/checks

Run a single external check on a device.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "checkType": "STOLEN",
  "identifier": "354123456789012"
}
```

**Response:** ExternalCheck object

---

### POST /api/checks/all

Run all available external checks.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "qlid": "QLID000000001",
  "imei": "354123456789012",
  "serial": "C02X..."
}
```

**Response:**

```json
{
  "checks": [ /* ExternalCheck[] */ ],
  "flags": {
    "reportedStolen": false,
    "financialHold": false,
    "activationLock": false
  },
  "summary": "All checks passed"
}
```

---

### GET /api/checks/:qlid

Get all external checks for a device.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "checks": [ /* ExternalCheck[] */ ],
  "flags": { ... },
  "summary": "All checks passed"
}
```

---

### GET /api/checks/:qlid/flags

Quick flag check for a device.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "reportedStolen": false,
  "financialHold": false,
  "activationLock": false
}
```

---

### GET /api/checks/cert/:certificationId

Get external checks linked to a certification.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "checks": [ /* ExternalCheck[] */ ],
  "summary": "All checks passed"
}
```

---

## Technicians

### GET /api/technicians

List all technicians.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "id": "uuid",
    "employeeId": "EMP001",
    "name": "Sam",
    "email": "sam@quicklotz.com",
    "specialties": ["LAPTOP", "PHONE", "TABLET"],
    "isActive": true,
    "createdAt": "2026-01-15T00:00:00.000Z"
  }
]
```

---

### POST /api/technicians

Add a new technician.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "name": "Sam",
  "email": "sam@quicklotz.com",
  "employeeId": "EMP001",
  "specialties": ["LAPTOP", "PHONE", "TABLET"]
}
```

**Response:** Created Technician object

---

### GET /api/technicians/:id/workload

Get a technician's current workload.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "itemCount": 8,
  "estimate": "3.5 hours"
}
```

---

## Settings

### GET /api/settings

Get application settings.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "default_warehouse": "WH-001",
  "default_printer_ip": "192.168.1.100",
  "auto_print_labels": true,
  "default_label_size": "2x1",
  "overhead_rate_per_item": 5.00,
  "labor_rate_per_hour": 22.00
}
```

---

### PUT /api/settings

Update settings. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Request Body:**

```json
{
  "auto_print_labels": false,
  "labor_rate_per_hour": 25.00
}
```

**Response:**

```json
{
  "success": true
}
```

---

## UPC Lookup

### GET /api/upc/search

Search the UPC database.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | -- | Search query (UPC, manufacturer, model) |
| `limit` | number | 20 | Max results |

**Response:** UPC result[]

---

### GET /api/upc/stats

Get UPC database statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalEntries": 50000,
  "bySource": { "barcodelookup": 30000, "manual": 5000, "kaggle": 15000 },
  "recentAdditions": 120
}
```

---

### POST /api/upc/manual

Manually add a UPC entry.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "upc": "887276678900",
  "manufacturer": "Samsung",
  "model": "QN55Q60C"
}
```

**Response:** Created UPC entry

---

### GET /api/upc/:upc

Look up a single UPC.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "upc": "887276678900",
  "manufacturer": "Samsung",
  "model": "QN55Q60C",
  "category": "TV",
  "msrp": 549.99,
  "title": "Samsung 55\" QLED 4K Smart TV",
  "source": "barcodelookup"
}
```

---

## Feed (Product Export)

### GET /api/feed/products

Get product data feed for external systems.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `json` | `json` |
| `since` | string | -- | ISO date, only items updated after this |
| `status` | string | -- | Filter by status |
| `grade` | FinalGrade | -- | Filter by grade |
| `category` | ProductCategory | -- | Filter by category |
| `limit` | number | 100 | Max results |
| `offset` | number | 0 | Pagination offset |

**Response:** Product feed data (format depends on `format` param)

---

### GET /api/feed/shopify

Get Shopify-formatted product feed.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `since` | string | -- | ISO date filter |
| `status` | string | `COMPLETE` | Item status filter |
| `limit` | number | 100 | Max results |

**Response:** Shopify-compatible JSON product array

---

### GET /api/feed/ebay

Get eBay-formatted product feed.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `since` | string | ISO date filter |
| `grade` | FinalGrade | Filter by grade |
| `limit` | number | Max results (default: 100) |

**Response:** eBay-compatible JSON product array

---

### GET /api/feed/csv

Get product feed as CSV.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Response Content-Type** | text/csv |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `since` | string | ISO date filter |
| `grade` | FinalGrade | Filter by grade |
| `category` | ProductCategory | Filter by category |
| `limit` | number | Max results (default: 100) |

---

### GET /api/feed/xml

Get product feed as XML.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Response Content-Type** | text/xml |

**Query Parameters:** Same as CSV feed.

---

### GET /api/feed/products/:qlid

Get a single product from the feed.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Single product object

---

### GET /api/feed/stats

Get feed statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalProducts": 500,
  "readyForExport": 350,
  "byGrade": { "A": 100, "B": 150, "C": 80, "D": 20 },
  "byCategory": { "LAPTOP": 200, "PHONE": 100 },
  "lastExportAt": "2026-02-20T08:00:00.000Z"
}
```

---

## Exports

### POST /api/exports

Create a new export job.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "type": "shopify",
  "format": "csv",
  "batchSize": 500,
  "filters": {
    "grade": "A",
    "category": "LAPTOP"
  }
}
```

**Response:** Export job object

---

### GET /api/exports

List all exports.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Export[]

---

### GET /api/exports/:exportName/files

List files in an export.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** File[] (filename, size, createdAt)

---

### GET /api/exports/download/:exportName/:filename

Download an export file.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Response Content-Type** | application/octet-stream |

---

### DELETE /api/exports/:exportName

Delete an export. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
{
  "success": true
}
```

---

### GET /api/exports/stats/summary

Get export statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "totalExports": 25,
  "totalFiles": 50,
  "totalSizeBytes": 15000000,
  "lastExportAt": "2026-02-20T08:00:00.000Z"
}
```

---

## Webhooks

### POST /api/webhooks

Create a webhook subscription. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Request Body:**

```json
{
  "name": "Shopify Sync",
  "url": "https://hooks.example.com/quickrefurbz",
  "events": ["item.completed", "item.certified", "item.graded"],
  "format": "json",
  "headers": {
    "X-API-Key": "sk_..."
  }
}
```

**Response:** Webhook object with `secret` for HMAC verification

---

### GET /api/webhooks

List webhooks.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `activeOnly` | boolean | If true, only active webhooks |

**Response:** Webhook[]

---

### GET /api/webhooks/:id

Get a webhook.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Webhook object

---

### PATCH /api/webhooks/:id

Update a webhook.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:** Partial webhook fields

**Response:** Updated webhook object

---

### DELETE /api/webhooks/:id

Delete a webhook. Admin only.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/webhooks/:id/regenerate-secret

Regenerate the webhook signing secret.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (admin) |

**Response:**

```json
{
  "secret": "whsec_..."
}
```

---

### POST /api/webhooks/:id/test

Send a test webhook delivery.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "success": true
}
```

---

### POST /api/webhooks/process-retries

Process failed webhook deliveries (retry queue).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "processed": 3
}
```

---

## Monitoring

### GET /api/monitor/stream

Server-Sent Events (SSE) stream for real-time updates.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |
| **Response Content-Type** | text/event-stream |

Events emitted:

| Event | Description |
|-------|-------------|
| `item.created` | New item intaked |
| `item.stage_changed` | Item moved to a new stage |
| `item.completed` | Item reached COMPLETE stage |
| `ticket.created` | New repair ticket |
| `ticket.resolved` | Ticket resolved |
| `pallet.created` | New pallet created |

---

### GET /api/monitor/dashboard

Full monitoring dashboard data. Requires monitor auth (HTTP Basic Auth or Bearer).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token or Basic Auth |

**Response:** Complete dashboard object with all metrics

---

### GET /api/monitor/overview

Overview statistics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Overview stats object

---

### GET /api/monitor/stages

Stage distribution across all items.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "INTAKE": 120,
  "TESTING": 85,
  "REPAIR": 42,
  "CLEANING": 30,
  "FINAL_QC": 18,
  "COMPLETE": 1205
}
```

---

### GET /api/monitor/throughput

Throughput data over time.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "hourly": [ { "hour": "2026-02-20T10:00:00.000Z", "received": 5, "completed": 3 } ],
  "daily": [ { "date": "2026-02-20", "received": 25, "completed": 18 } ]
}
```

---

### GET /api/monitor/technicians

Technician performance metrics.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Sam",
    "activeItems": 5,
    "completedToday": 8,
    "averageMinutesPerItem": 22,
    "currentStage": "REPAIR"
  }
]
```

---

### GET /api/monitor/grades

Grade distribution.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "NEW": 10,
  "A": 120,
  "B": 200,
  "C": 100,
  "D": 50,
  "SALVAGE": 20
}
```

---

### GET /api/monitor/alerts

Active system alerts.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "id": "uuid",
    "severity": "warning",
    "message": "8 parts at or below reorder point",
    "category": "parts",
    "createdAt": "2026-02-20T10:00:00.000Z"
  }
]
```

---

### GET /api/monitor/activity

Recent activity feed.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Activity event[]

---

### GET /api/monitor/reports/productivity

Productivity report for a date range.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `startDate` | string | Yes | ISO date |
| `endDate` | string | Yes | ISO date |

**Response:** Detailed productivity report

---

### GET /api/monitor/reports/inventory

Inventory health report.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:** Inventory health metrics

---

### GET /api/monitor/clients

Get count of connected SSE clients.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "connectedClients": 3
}
```

---

### GET /api/monitor/stations

Get station statuses (heartbeat data).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "station_id": "station01",
    "workstation_id": "WS-01",
    "last_heartbeat": "2026-02-20T12:00:00.000Z",
    "current_page": "/workflow",
    "online": true
  }
]
```

---

## Sessions (Work)

### GET /api/session

Get the active work session for the current user.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "session": {
    "id": "uuid",
    "employeeId": "EMP001",
    "workstationId": "WS-01",
    "warehouseId": "WH-001",
    "startedAt": "2026-02-20T08:00:00.000Z",
    "itemsProcessed": 12
  },
  "requiresSession": false
}
```

---

### POST /api/session/start

Start a new work session.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "employeeId": "EMP001",
  "workstationId": "WS-01",
  "warehouseId": "WH-001"
}
```

**Response:** Session object

---

### POST /api/session/end

End the current work session.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "notes": "End of shift"
}
```

**Response:**

```json
{
  "ok": true
}
```

---

## Stations

### POST /api/stations/heartbeat

Send a station heartbeat (called periodically by station clients).

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (station) |

**Request Body:**

```json
{
  "station_id": "station01",
  "current_page": "/workflow"
}
```

**Response:**

```json
{
  "ok": true
}
```

---

### POST /api/stations/setup-complete

Mark station setup as complete.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token (station) |

**Request Body:**

```json
{
  "station_id": "station01",
  "workstation_id": "WS-01"
}
```

**Response:**

```json
{
  "ok": true
}
```

---

## AI

### GET /api/ai/status

Check AI integration status and capabilities.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "configured": true,
  "model": "claude-sonnet-4-5-20250929",
  "features": {
    "grading": true,
    "description": true,
    "identification": true
  }
}
```

---

### POST /api/ai/grade-photos/:qlid

Auto-grade an item based on its photos using AI vision.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "suggestedGrade": "B",
  "confidence": 0.85,
  "reasoning": "Minor scratches visible on lid. Screen in excellent condition. All ports clean.",
  "defectsDetected": [
    { "area": "lid", "type": "scratch", "severity": "MINOR" }
  ]
}
```

---

### POST /api/ai/describe/:qlid

Generate a product listing description using AI.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Request Body:**

```json
{
  "grade": "B"
}
```

**Response:**

```json
{
  "title": "Apple MacBook Pro 14\" M3 - Certified Very Good",
  "description": "This professionally refurbished MacBook Pro 14\" features the M3 chip...",
  "bulletPoints": [
    "Certified Grade B - Very Good condition",
    "Fully tested and verified by Upscaled technicians",
    "90-day Upscaled Guarantee included"
  ],
  "tags": ["apple", "macbook", "laptop", "refurbished"]
}
```

---

### POST /api/ai/identify/:qlid

Identify a product from its photos using AI vision.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "manufacturer": "Apple",
  "model": "MacBook Pro 14\" M3",
  "category": "LAPTOP",
  "confidence": 0.92,
  "msrp": 1999.00,
  "upc": "194253945802"
}
```

---

### GET /api/ai/history/:qlid

Get AI action history for an item.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
[
  {
    "action": "grade-photos",
    "result": { "suggestedGrade": "B" },
    "model": "claude-sonnet-4-5-20250929",
    "timestamp": "2026-02-20T12:00:00.000Z"
  }
]
```

---

## Health

### GET /api/health

Health check endpoint.

| Field | Value |
|-------|-------|
| **Auth** | None |

**Response:**

```json
{
  "status": "healthy",
  "db": "connected",
  "uptime": 864000,
  "version": "1.4.1"
}
```

---

### GET /api/health/sourcing

Sourcing database health check.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "status": "ok",
  "latencyMs": 12
}
```

---

## Kanban

### GET /api/kanban

Get all items organized by stage for a kanban board view.

| Field | Value |
|-------|-------|
| **Auth** | Bearer token |

**Response:**

```json
{
  "INTAKE": [ /* RefurbItem[] */ ],
  "TESTING": [ /* RefurbItem[] */ ],
  "REPAIR": [ /* RefurbItem[] */ ],
  "CLEANING": [ /* RefurbItem[] */ ],
  "FINAL_QC": [ /* RefurbItem[] */ ],
  "COMPLETE": [ /* RefurbItem[] */ ]
}
```

---

## Enums & Reference Values

### ProductCategory

Product categories for items.

| Value | Display |
|-------|---------|
| `PHONE` | Phone |
| `TABLET` | Tablet |
| `LAPTOP` | Laptop |
| `DESKTOP` | Desktop |
| `TV` | TV |
| `MONITOR` | Monitor |
| `AUDIO` | Audio |
| `APPLIANCE_SMALL` | Small Appliance |
| `APPLIANCE_LARGE` | Large Appliance |
| `ICE_MAKER` | Ice Maker |
| `VACUUM` | Vacuum |
| `GAMING` | Gaming |
| `WEARABLE` | Wearable |
| `OTHER` | Other |

### RefurbStage (6-stage pipeline)

The high-level 6-stage refurbishment pipeline. Each item moves through these stages sequentially.

| Value | Display | Description |
|-------|---------|-------------|
| `INTAKE` | Intake | Received from QuickIntakez |
| `TESTING` | Testing | Diagnostic testing |
| `REPAIR` | Repair | Repair work |
| `CLEANING` | Cleaning | Cosmetic cleaning |
| `FINAL_QC` | Final QC | Quality control |
| `COMPLETE` | Complete | Ready for next workflow |

### RefurbState (15-state workflow)

Fine-grained workflow states used by the workflow job system.

**Normal flow:**

| Value | Display | Type |
|-------|---------|------|
| `REFURBZ_QUEUED` | Queued | NORMAL |
| `REFURBZ_ASSIGNED` | Assigned | NORMAL |
| `REFURBZ_IN_PROGRESS` | In Progress | NORMAL |
| `SECURITY_PREP_COMPLETE` | Security Prep Complete | NORMAL |
| `DIAGNOSED` | Diagnosed | NORMAL |
| `REPAIR_IN_PROGRESS` | Repair In Progress | NORMAL |
| `REPAIR_COMPLETE` | Repair Complete | NORMAL |
| `FINAL_TEST_IN_PROGRESS` | Final Test In Progress | NORMAL |
| `FINAL_TEST_PASSED` | Final Test Passed | NORMAL |
| `CERTIFIED` | Certified | NORMAL |
| `REFURBZ_COMPLETE` | Complete | TERMINAL |

**Escape routes:**

| Value | Display | Type |
|-------|---------|------|
| `REFURBZ_BLOCKED` | Blocked | ESCAPE |
| `REFURBZ_ESCALATED` | Escalated | ESCAPE |
| `FINAL_TEST_FAILED` | Final Test Failed | ESCAPE |
| `REFURBZ_FAILED_DISPOSITION` | Failed - Disposition Required | TERMINAL |

### FinalGrade

Grade assigned after refurbishment.

| Value | Display | Description |
|-------|---------|-------------|
| `NEW` | New | Unused, unopened, pristine with original intact packaging |
| `A` | Like New / Open Box | Perfect working condition, no signs of wear |
| `B` | Very Good | Minimal, limited signs of wear, fully functional |
| `C` | Good | Noticeable wear, good working condition |
| `D` | Acceptable | Significant wear, still fully functional |
| `SALVAGE` | Salvage | Non-functional or missing essential parts |

### CertificationLevel

Certification levels issued after diagnostics.

| Value | Display | Maps to Grade | Warranty Days |
|-------|---------|---------------|---------------|
| `EXCELLENT` | Certified Excellent | A | 90 |
| `GOOD` | Certified Good | B | 60 |
| `FAIR` | Certified Fair | C | 30 |
| `NOT_CERTIFIED` | Not Certified | SALVAGE | 0 |

### StepType

Types of workflow steps in SOPs.

| Value | Description |
|-------|-------------|
| `CHECKLIST` | Multiple yes/no items to verify |
| `INPUT` | Free-form text or structured data input |
| `MEASUREMENT` | Numeric measurement with unit and thresholds |
| `PHOTO` | Photo capture requirement (before/after/defect/serial) |
| `CONFIRMATION` | Simple confirmation prompt |

### TransitionAction

Actions that trigger workflow state transitions.

| Value | Description |
|-------|-------------|
| `ADVANCE` | Move to the next state in normal flow |
| `BLOCK` | Mark job as blocked (moves to REFURBZ_BLOCKED) |
| `ESCALATE` | Escalate to supervisor (moves to REFURBZ_ESCALATED) |
| `FAIL` | Mark as failed (moves to REFURBZ_FAILED_DISPOSITION) |
| `RESOLVE` | Resolve a blocked/escalated job (returns to normal flow) |
| `RETRY` | Retry after test failure (loops back to FINAL_TEST_IN_PROGRESS) |

### JobPriority

| Value | Display |
|-------|---------|
| `LOW` | Low |
| `NORMAL` | Normal |
| `HIGH` | High |
| `URGENT` | Urgent |

### IssueSeverity

| Value | Display |
|-------|---------|
| `CRITICAL` | Critical - Non-functional |
| `MAJOR` | Major - Partial functionality |
| `MINOR` | Minor - Fully functional with issues |
| `COSMETIC` | Cosmetic - Appearance only |

### TicketStatus

| Value | Description |
|-------|-------------|
| `OPEN` | Newly created |
| `IN_PROGRESS` | Being worked on |
| `RESOLVED` | Repair completed |
| `CANNOT_REPAIR` | Deemed unrepairable |

### PalletStatus

| Value | Description |
|-------|-------------|
| `RECEIVING` | Items being received from manifest |
| `IN_PROGRESS` | Items being processed |
| `COMPLETE` | All items processed |

### Retailer

Original store where liquidation products came from.

| Value | Display | Code |
|-------|---------|------|
| `BESTBUY` | Best Buy | BBY |
| `TARGET` | Target | TGT |
| `AMAZON` | Amazon | AMZ |
| `COSTCO` | Costco | CST |
| `WALMART` | Walmart | WMT |
| `KOHLS` | Kohl's | KHL |
| `HOMEDEPOT` | Home Depot | HDP |
| `LOWES` | Lowe's | LOW |
| `SAMSCLUB` | Sam's Club | SAM |
| `OTHER` | Other | OTH |

### LiquidationSource

Where pallets are purchased from.

| Value | Display |
|-------|---------|
| `QUICKLOTZ` | QuickLotz |
| `DIRECTLIQUIDATION` | DirectLiquidation |
| `BSTOCK` | B-Stock |
| `BULQ` | BULQ |
| `LIQUIDATION_COM` | Liquidation.com |
| `OTHER` | Other |

### PartCategory

| Value | Display |
|-------|---------|
| `SCREEN` | Screen |
| `BATTERY` | Battery |
| `CABLE` | Cable |
| `CHARGER` | Charger |
| `KEYBOARD` | Keyboard |
| `MEMORY` | Memory |
| `STORAGE` | Storage |
| `FAN` | Fan |
| `SPEAKER` | Speaker |
| `CAMERA` | Camera |
| `OTHER` | Other |

### WarrantyType

| Value | Display |
|-------|---------|
| `MANUFACTURER` | Manufacturer Warranty |
| `EXTENDED` | Extended Warranty |
| `RETAILER` | Retailer Warranty |
| `UPSCALED` | Upscaled Warranty |
| `NONE` | No Warranty |

### WarrantyStatus

| Value | Display |
|-------|---------|
| `ACTIVE` | Active |
| `EXPIRED` | Expired |
| `VOIDED` | Voided |
| `UNKNOWN` | Unknown |
| `NOT_APPLICABLE` | N/A |

### DiagnosticTestType

| Value | Description |
|-------|-------------|
| `FUNCTIONAL` | Does the component work? |
| `MEASUREMENT` | Quantifiable metric (suction power, temperature, etc.) |
| `VISUAL` | Visual inspection (cosmetic, damage) |
| `SAFETY` | Safety-related checks (electrical, heat) |

### Error Codes

Standard API error codes returned in the `error.code` field.

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request body or parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method not supported |
| `CONFLICT` | 409 | Resource conflict (duplicate) |
| `UNPROCESSABLE_ENTITY` | 422 | Valid syntax but semantic errors |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `NOT_IMPLEMENTED` | 501 | Feature not implemented |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `TOKEN_EXPIRED` | 401 | JWT token has expired |
| `TOKEN_INVALID` | 401 | JWT token is malformed or invalid |
| `INSUFFICIENT_PERMISSIONS` | 403 | User role lacks required permission |
| `RESOURCE_LOCKED` | 423 | Resource is locked by another operation |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in window |

---

## ID Formats

| ID Type | Format | Example |
|---------|--------|---------|
| QLID | `QLID{9 digits}` | `QLID000000001` |
| Pallet (internal) | `P{num}{3-letter code}` | `P1BBY`, `P23TGT` |
| Pallet (QR system) | `QR{7 digits}` | `QR0000001` |
| Barcode (RFB) | `RFB-{PalletID}-{QLID}` | `RFB-P1BBY-QLID000000001` |
| Barcode (legacy) | `{PalletID}-{QLID}` | `P1BBY-QLID000000001` |
| QSKU (refurb SKU) | `RFB-{QLID}` | `RFB-QLID000000001` |
| Certification ID | `UC-{YYYYMMDD}-{4 digits}` | `UC-20260220-0001` |
| Data Wipe Cert | `DW-{YYYYMMDD}-{4 digits}` | `DW-20260218-0001` |
| Ticket Number | `TK{7 digits}` | `TK0000001` |

---

## Webhook Events

Events that can be subscribed to via the webhooks system.

| Event | Description | Payload |
|-------|-------------|---------|
| `item.created` | New item intaked | RefurbItem |
| `item.stage_changed` | Item moved to new stage | RefurbItem + fromStage, toStage |
| `item.completed` | Item reached COMPLETE | RefurbItem + finalGrade |
| `item.certified` | Certification issued | Certification |
| `item.graded` | Grade assigned | RefurbItem + grade |
| `ticket.created` | New repair ticket | RepairTicket |
| `ticket.resolved` | Ticket resolved | RepairTicket |
| `pallet.created` | New pallet created | Pallet |
| `pallet.completed` | All pallet items processed | Pallet |
| `job.state_changed` | Workflow job state changed | RefurbJob |
| `job.completed` | Workflow job completed | RefurbJob |
| `export.completed` | Export job finished | Export |

Webhook payloads are signed with HMAC-SHA256 using the webhook secret. Verify the `X-QuickRefurbz-Signature` header.

```
X-QuickRefurbz-Signature: sha256=<hex-digest>
```
