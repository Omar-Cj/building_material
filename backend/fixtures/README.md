# Building Material Inventory Seed Data

This directory contains seed data for populating the inventory system with realistic building material categories, units of measurement, and materials.

## Usage

### Method 1: Django Management Command (Recommended)

```bash
# Seed inventory data
python manage.py seed_inventory

# Clear existing data and seed fresh
python manage.py seed_inventory --clear
```

### Method 2: Django Fixtures

```bash
# Load from JSON fixture
python manage.py loaddata fixtures/inventory_seed_data.json
```

## What's Included

### Categories (Hierarchical Structure)
- **Structural Materials**
  - Concrete Products
  - Steel Products  
  - Wood & Lumber
  - Masonry Materials

- **Roofing Materials**
  - Roofing Tiles
  - Metal Roofing
  - Roofing Membranes

- **Finishing Materials**
  - Paints & Coatings
  - Flooring Materials
  - Doors & Windows

- **Electrical Materials**
  - Wiring & Cables
  - Electrical Fixtures
  - Electrical Panels
  - Conduits & Fittings

- **Plumbing Materials**
  - Pipes & Fittings
  - Plumbing Fixtures
  - Valves & Controls

- **Insulation & Waterproofing**
  - Thermal Insulation
  - Waterproof Membranes
  - Sealants & Caulks

- **Site Preparation**
  - Aggregates

- **Hardware & Fasteners**
  - Screws & Bolts
  - Nails & Staples
  - Construction Adhesives

- **Glass & Glazing**
- **Landscaping Materials**

### Units of Measurement
- **Volume**: Cubic Meter (m³), Liter (L)
- **Area**: Square Meter (m²)
- **Length**: Meter (m)
- **Weight**: Kilogram (kg), Ton (t)
- **Count**: Piece (pcs), Sheet, Bag, Box, Roll

### 100+ Materials
Comprehensive building materials including:
- Concrete products (ready-mix, blocks, precast)
- Steel products (rebar, structural steel, sheets)
- Lumber (dimensional, plywood, engineered)
- Roofing materials (tiles, sheets, membranes)
- Electrical supplies (cables, switches, panels)
- Plumbing supplies (pipes, fittings, fixtures)
- Finishing materials (paints, tiles, flooring)
- Hardware and fasteners
- Insulation and waterproofing materials
- Aggregates and site preparation materials

## Features

- **Realistic Pricing**: Materials include cost and selling prices based on market research
- **Inventory Management**: Reorder levels and quantities for stock management
- **Industry Standards**: Based on construction industry classification systems
- **Hierarchical Categories**: Organized structure for easy navigation
- **Comprehensive Coverage**: Covers all major building material categories
- **Portable**: Can be run on any machine with the Django project

## Notes

- All materials start with zero stock quantity
- Pricing is in local currency units
- Categories support parent-child relationships
- Materials include proper unit assignments
- Ready for immediate use in building material businesses