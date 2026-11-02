# Simple Product Ordering System

A clean, responsive, and minimal Product Ordering System built with Node.js, Express, SQLite, React, and Tailwind CSS.

## Architecture

- **Backend**: Express.js REST API with Node.js built-in SQLite (`node:sqlite`) for reliable, zero-dependency relational data persistence.
- **Frontend**: React + Tailwind CSS with Lucide icons (responsive desktop, tablet, and mobile layouts).
- **File Storage**: Uploaded product images stored permanently on disk in `/uploads/products/`.
- **Excel Export**: Native `.xlsx` generation using `exceljs` with clear column headers and styling.

---

## Features

### 1. Customer Order Form (2-Step Process)
- **Step 1 – Product Details**:
  - Promoter ID (Text input)
  - Product Dropdown (Populated exclusively from active products in database, with instant image preview)
  - Quantity (Number input, minimum 1)
  - Next button with field validation
- **Step 2 – Customer Address Details**:
  - Full Name
  - Phone Number
  - **Complete Address**: ONE single large textarea containing House Number, Building, Road, Area, and Landmark
  - Pincode, City, State inputs
  - Back button (preserves all entered data from both steps)
  - Make Order button with duplicate submission protection
- **Order Confirmation**:
  - Automatically generates unique Order ID (e.g. `ORD-20261102-XXXX`)
  - Records precise date and time in database
  - Shows success window with one-click copyable Order ID and summary

### 2. Admin Panel
- **Secure Admin Authentication**:
  - Default Credentials: Username `admin`, Password `admin123`
  - JWT token + HTTP-only cookie authentication protecting admin APIs and views
- **Product Management**:
  - Add product with product name and permanent image upload
  - View all products
  - Edit product details (name, image, active/inactive toggle)
  - Delete products
  - Only active products appear in the customer order form
- **Order Management**:
  - All 11 required columns displayed in a clean table on desktop and stacked adaptive cards on mobile:
    1. Order ID
    2. Order Date & Time
    3. Promoter ID
    4. Product Name
    5. Quantity
    6. Customer Name
    7. Phone Number
    8. Complete Address
    9. Pincode
    10. City
    11. State
  - "View Details" modal for viewing complete address without table truncation
- **Excel Export (.xlsx)**:
  - "Export Excel (.xlsx)" button on orders page
  - Generates real `.xlsx` Excel workbook with single worksheet ("Orders")
  - Directly triggers browser download

---

## Quick Start

### 1. Start Server & Production Build
```bash
npm start
```
The application will run at:
**[http://localhost:5000](http://localhost:5000)**

### 2. Run Automated Verification Tests
```bash
node test/e2e-test.js
```
Runs the automated E2E test verifying customer order submission, duplicate prevention, database persistence, Excel generation, and admin CRUD.

---

## Credentials
- **Admin Username**: `admin`
- **Admin Password**: `admin123`

