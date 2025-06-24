from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal
from inventory.models import Category, UnitOfMeasure, Material


class Command(BaseCommand):
    help = 'Seed inventory with categories, units, and materials for building material business'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing inventory data...')
            with transaction.atomic():
                Material.objects.all().delete()
                Category.objects.all().delete()
                UnitOfMeasure.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Existing data cleared.'))

        self.stdout.write('Starting inventory seeding...')
        
        with transaction.atomic():
            # Create units of measurement
            units = self.create_units()
            self.stdout.write(f'Created {len(units)} units of measurement.')
            
            # Create categories
            categories = self.create_categories()
            self.stdout.write(f'Created {len(categories)} categories.')
            
            # Create materials
            materials = self.create_materials(categories, units)
            self.stdout.write(f'Created {len(materials)} materials.')

        self.stdout.write(self.style.SUCCESS('Inventory seeding completed successfully!'))

    def create_units(self):
        units_data = [
            # Volume units
            {'name': 'Cubic Meter', 'abbreviation': 'm³', 'description': 'Volume measurement for concrete, aggregates, etc.'},
            {'name': 'Liter', 'abbreviation': 'L', 'description': 'Volume measurement for liquids'},
            {'name': 'Gallon', 'abbreviation': 'gal', 'description': 'Volume measurement for liquids (US)'},
            
            # Area units
            {'name': 'Square Meter', 'abbreviation': 'm²', 'description': 'Area measurement for sheets, tiles, etc.'},
            {'name': 'Square Foot', 'abbreviation': 'ft²', 'description': 'Area measurement (Imperial)'},
            
            # Length units
            {'name': 'Meter', 'abbreviation': 'm', 'description': 'Linear measurement'},
            {'name': 'Foot', 'abbreviation': 'ft', 'description': 'Linear measurement (Imperial)'},
            {'name': 'Millimeter', 'abbreviation': 'mm', 'description': 'Precise linear measurement'},
            {'name': 'Inch', 'abbreviation': 'in', 'description': 'Linear measurement (Imperial)'},
            
            # Weight units
            {'name': 'Kilogram', 'abbreviation': 'kg', 'description': 'Weight measurement'},
            {'name': 'Ton', 'abbreviation': 't', 'description': 'Heavy weight measurement'},
            {'name': 'Pound', 'abbreviation': 'lbs', 'description': 'Weight measurement (Imperial)'},
            {'name': 'Quintal', 'abbreviation': 'q', 'description': 'Weight measurement for steel'},
            
            # Count units
            {'name': 'Piece', 'abbreviation': 'pcs', 'description': 'Individual items'},
            {'name': 'Set', 'abbreviation': 'set', 'description': 'Collection of items'},
            {'name': 'Roll', 'abbreviation': 'roll', 'description': 'Rolled materials'},
            {'name': 'Sheet', 'abbreviation': 'sheet', 'description': 'Flat materials'},
            {'name': 'Bundle', 'abbreviation': 'bundle', 'description': 'Bundled materials'},
            {'name': 'Bag', 'abbreviation': 'bag', 'description': 'Bagged materials'},
            {'name': 'Box', 'abbreviation': 'box', 'description': 'Boxed materials'},
            {'name': 'Carton', 'abbreviation': 'carton', 'description': 'Carton packaging'},
        ]
        
        created_units = {}
        for unit_data in units_data:
            unit, created = UnitOfMeasure.objects.get_or_create(
                name=unit_data['name'],
                defaults={
                    'abbreviation': unit_data['abbreviation'],
                    'description': unit_data['description']
                }
            )
            created_units[unit_data['name']] = unit
        
        return created_units

    def create_categories(self):
        categories_data = [
            # Main categories
            {'name': 'Structural Materials', 'description': 'Load-bearing construction materials', 'parent': None},
            {'name': 'Roofing Materials', 'description': 'Materials for roof construction and waterproofing', 'parent': None},
            {'name': 'Finishing Materials', 'description': 'Interior and exterior finishing materials', 'parent': None},
            {'name': 'Electrical Materials', 'description': 'Electrical installation materials', 'parent': None},
            {'name': 'Plumbing Materials', 'description': 'Water supply and drainage materials', 'parent': None},
            {'name': 'Insulation & Waterproofing', 'description': 'Thermal and moisture protection materials', 'parent': None},
            {'name': 'Site Preparation', 'description': 'Excavation and foundation materials', 'parent': None},
            {'name': 'Hardware & Fasteners', 'description': 'Joining and fastening materials', 'parent': None},
            {'name': 'Glass & Glazing', 'description': 'Glass products and glazing materials', 'parent': None},
            {'name': 'Landscaping Materials', 'description': 'Outdoor and landscaping materials', 'parent': None},
        ]
        
        # Subcategories
        subcategories_data = [
            # Structural Materials subcategories
            {'name': 'Concrete Products', 'description': 'Ready-mix concrete, blocks, precast elements', 'parent': 'Structural Materials'},
            {'name': 'Steel Products', 'description': 'Structural steel, reinforcement, sheets', 'parent': 'Structural Materials'},
            {'name': 'Wood & Lumber', 'description': 'Timber, engineered wood, treated lumber', 'parent': 'Structural Materials'},
            {'name': 'Masonry Materials', 'description': 'Bricks, blocks, stones, mortar', 'parent': 'Structural Materials'},
            
            # Roofing Materials subcategories
            {'name': 'Roofing Tiles', 'description': 'Clay, concrete, and composite tiles', 'parent': 'Roofing Materials'},
            {'name': 'Metal Roofing', 'description': 'Steel, aluminum, and copper roofing', 'parent': 'Roofing Materials'},
            {'name': 'Roofing Membranes', 'description': 'Waterproof membranes and underlayments', 'parent': 'Roofing Materials'},
            {'name': 'Roof Accessories', 'description': 'Gutters, downspouts, flashing', 'parent': 'Roofing Materials'},
            
            # Finishing Materials subcategories
            {'name': 'Paints & Coatings', 'description': 'Interior and exterior paints, primers, sealers', 'parent': 'Finishing Materials'},
            {'name': 'Flooring Materials', 'description': 'Tiles, vinyl, laminate, hardwood', 'parent': 'Finishing Materials'},
            {'name': 'Wall Coverings', 'description': 'Wallpaper, panels, decorative materials', 'parent': 'Finishing Materials'},
            {'name': 'Doors & Windows', 'description': 'Entry doors, windows, frames', 'parent': 'Finishing Materials'},
            {'name': 'Ceiling Materials', 'description': 'Suspended ceilings, tiles, panels', 'parent': 'Finishing Materials'},
            
            # Electrical Materials subcategories
            {'name': 'Wiring & Cables', 'description': 'Electrical cables, wires, conduits', 'parent': 'Electrical Materials'},
            {'name': 'Electrical Fixtures', 'description': 'Switches, outlets, lighting fixtures', 'parent': 'Electrical Materials'},
            {'name': 'Electrical Panels', 'description': 'Distribution panels, breakers, meters', 'parent': 'Electrical Materials'},
            {'name': 'Conduits & Fittings', 'description': 'Electrical conduits and accessories', 'parent': 'Electrical Materials'},
            
            # Plumbing Materials subcategories
            {'name': 'Pipes & Fittings', 'description': 'Water supply and drainage pipes', 'parent': 'Plumbing Materials'},
            {'name': 'Plumbing Fixtures', 'description': 'Sinks, toilets, faucets, showers', 'parent': 'Plumbing Materials'},
            {'name': 'Valves & Controls', 'description': 'Shut-off valves, control valves', 'parent': 'Plumbing Materials'},
            {'name': 'Water Heaters', 'description': 'Storage and tankless water heaters', 'parent': 'Plumbing Materials'},
            
            # Insulation & Waterproofing subcategories
            {'name': 'Thermal Insulation', 'description': 'Fiberglass, foam, mineral wool insulation', 'parent': 'Insulation & Waterproofing'},
            {'name': 'Waterproof Membranes', 'description': 'Foundation and deck waterproofing', 'parent': 'Insulation & Waterproofing'},
            {'name': 'Sealants & Caulks', 'description': 'Joint sealers and caulking materials', 'parent': 'Insulation & Waterproofing'},
            
            # Site Preparation subcategories
            {'name': 'Aggregates', 'description': 'Sand, gravel, crushed stone', 'parent': 'Site Preparation'},
            {'name': 'Excavation Materials', 'description': 'Fill dirt, topsoil, clay', 'parent': 'Site Preparation'},
            {'name': 'Foundation Materials', 'description': 'Concrete blocks, foundation systems', 'parent': 'Site Preparation'},
            
            # Hardware & Fasteners subcategories
            {'name': 'Screws & Bolts', 'description': 'Various screws, bolts, and nuts', 'parent': 'Hardware & Fasteners'},
            {'name': 'Nails & Staples', 'description': 'Construction nails and staples', 'parent': 'Hardware & Fasteners'},
            {'name': 'Construction Adhesives', 'description': 'Structural and general adhesives', 'parent': 'Hardware & Fasteners'},
        ]
        
        created_categories = {}
        
        # Create main categories first
        for cat_data in categories_data:
            category, created = Category.objects.get_or_create(
                name=cat_data['name'],
                defaults={
                    'description': cat_data['description'],
                    'parent': None
                }
            )
            created_categories[cat_data['name']] = category
        
        # Create subcategories
        for subcat_data in subcategories_data:
            parent_category = created_categories.get(subcat_data['parent'])
            if parent_category:
                subcategory, created = Category.objects.get_or_create(
                    name=subcat_data['name'],
                    defaults={
                        'description': subcat_data['description'],
                        'parent': parent_category
                    }
                )
                created_categories[subcat_data['name']] = subcategory
        
        return created_categories

    def create_materials(self, categories, units):
        materials_data = [
            # Concrete Products
            {'name': 'Ready-Mix Concrete M25', 'description': 'Standard grade concrete for general construction', 'category': 'Concrete Products', 'unit': 'Cubic Meter', 'price': 8500, 'cost': 7500, 'reorder_level': 5, 'reorder_qty': 20},
            {'name': 'Ready-Mix Concrete M30', 'description': 'High-strength concrete for structural elements', 'category': 'Concrete Products', 'unit': 'Cubic Meter', 'price': 9200, 'cost': 8100, 'reorder_level': 3, 'reorder_qty': 15},
            {'name': 'Concrete Blocks 200mm', 'description': 'Standard concrete masonry units', 'category': 'Concrete Products', 'unit': 'Piece', 'price': 45, 'cost': 35, 'reorder_level': 100, 'reorder_qty': 500},
            {'name': 'Concrete Blocks 150mm', 'description': 'Lightweight concrete masonry units', 'category': 'Concrete Products', 'unit': 'Piece', 'price': 38, 'cost': 30, 'reorder_level': 150, 'reorder_qty': 600},
            {'name': 'Precast Concrete Slabs', 'description': 'Factory-made concrete slabs', 'category': 'Concrete Products', 'unit': 'Square Meter', 'price': 1200, 'cost': 1000, 'reorder_level': 20, 'reorder_qty': 100},
            
            # Steel Products
            {'name': 'Steel Rebar 12mm', 'description': 'Reinforcing steel bars for concrete', 'category': 'Steel Products', 'unit': 'Kilogram', 'price': 65, 'cost': 55, 'reorder_level': 500, 'reorder_qty': 2000},
            {'name': 'Steel Rebar 16mm', 'description': 'Heavy-duty reinforcing steel bars', 'category': 'Steel Products', 'unit': 'Kilogram', 'price': 68, 'cost': 58, 'reorder_level': 300, 'reorder_qty': 1500},
            {'name': 'Steel Rebar 20mm', 'description': 'Extra heavy reinforcing steel bars', 'category': 'Steel Products', 'unit': 'Kilogram', 'price': 70, 'cost': 60, 'reorder_level': 200, 'reorder_qty': 1000},
            {'name': 'Structural Steel Beams', 'description': 'I-beams for structural construction', 'category': 'Steel Products', 'unit': 'Kilogram', 'price': 75, 'cost': 65, 'reorder_level': 500, 'reorder_qty': 2000},
            {'name': 'Steel Sheets 1mm', 'description': 'Galvanized steel sheets', 'category': 'Steel Products', 'unit': 'Square Meter', 'price': 850, 'cost': 720, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Steel Sheets 2mm', 'description': 'Heavy-duty galvanized steel sheets', 'category': 'Steel Products', 'unit': 'Square Meter', 'price': 1200, 'cost': 1000, 'reorder_level': 30, 'reorder_qty': 150},
            
            # Wood & Lumber
            {'name': 'Pine Lumber 2x4', 'description': 'Standard construction lumber', 'category': 'Wood & Lumber', 'unit': 'Piece', 'price': 285, 'cost': 240, 'reorder_level': 100, 'reorder_qty': 500},
            {'name': 'Pine Lumber 2x6', 'description': 'Heavy-duty construction lumber', 'category': 'Wood & Lumber', 'unit': 'Piece', 'price': 420, 'cost': 350, 'reorder_level': 75, 'reorder_qty': 300},
            {'name': 'Pine Lumber 2x8', 'description': 'Structural lumber for joists', 'category': 'Wood & Lumber', 'unit': 'Piece', 'price': 560, 'cost': 470, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Plywood 18mm', 'description': 'Marine grade plywood sheets', 'category': 'Wood & Lumber', 'unit': 'Sheet', 'price': 2800, 'cost': 2300, 'reorder_level': 25, 'reorder_qty': 100},
            {'name': 'Plywood 12mm', 'description': 'Standard plywood sheets', 'category': 'Wood & Lumber', 'unit': 'Sheet', 'price': 2200, 'cost': 1850, 'reorder_level': 30, 'reorder_qty': 120},
            {'name': 'Engineered Lumber LVL', 'description': 'Laminated veneer lumber beams', 'category': 'Wood & Lumber', 'unit': 'Piece', 'price': 850, 'cost': 720, 'reorder_level': 20, 'reorder_qty': 80},
            
            # Masonry Materials
            {'name': 'Red Clay Bricks', 'description': 'Standard fired clay bricks', 'category': 'Masonry Materials', 'unit': 'Piece', 'price': 12, 'cost': 8, 'reorder_level': 1000, 'reorder_qty': 5000},
            {'name': 'Fly Ash Bricks', 'description': 'Eco-friendly lightweight bricks', 'category': 'Masonry Materials', 'unit': 'Piece', 'price': 10, 'cost': 7, 'reorder_level': 1200, 'reorder_qty': 6000},
            {'name': 'Cement Mortar', 'description': 'Ready-mix mortar for masonry', 'category': 'Masonry Materials', 'unit': 'Bag', 'price': 320, 'cost': 280, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Natural Stone Blocks', 'description': 'Granite/limestone blocks', 'category': 'Masonry Materials', 'unit': 'Cubic Meter', 'price': 3500, 'cost': 2800, 'reorder_level': 5, 'reorder_qty': 25},
            
            # Roofing Tiles
            {'name': 'Clay Roof Tiles', 'description': 'Traditional clay roofing tiles', 'category': 'Roofing Tiles', 'unit': 'Piece', 'price': 25, 'cost': 18, 'reorder_level': 500, 'reorder_qty': 2000},
            {'name': 'Concrete Roof Tiles', 'description': 'Durable concrete roofing tiles', 'category': 'Roofing Tiles', 'unit': 'Piece', 'price': 22, 'cost': 16, 'reorder_level': 600, 'reorder_qty': 2500},
            {'name': 'Composite Roof Tiles', 'description': 'Lightweight composite tiles', 'category': 'Roofing Tiles', 'unit': 'Piece', 'price': 35, 'cost': 28, 'reorder_level': 300, 'reorder_qty': 1200},
            
            # Metal Roofing
            {'name': 'Corrugated Steel Sheets', 'description': 'Galvanized corrugated roofing', 'category': 'Metal Roofing', 'unit': 'Sheet', 'price': 1200, 'cost': 950, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Aluminum Roofing Sheets', 'description': 'Lightweight aluminum roofing', 'category': 'Metal Roofing', 'unit': 'Sheet', 'price': 1800, 'cost': 1450, 'reorder_level': 30, 'reorder_qty': 120},
            {'name': 'Standing Seam Metal Roofing', 'description': 'Premium metal roofing system', 'category': 'Metal Roofing', 'unit': 'Square Meter', 'price': 2500, 'cost': 2000, 'reorder_level': 100, 'reorder_qty': 400},
            
            # Roofing Membranes
            {'name': 'EPDM Roofing Membrane', 'description': 'Rubber roofing membrane', 'category': 'Roofing Membranes', 'unit': 'Square Meter', 'price': 450, 'cost': 380, 'reorder_level': 200, 'reorder_qty': 800},
            {'name': 'TPO Roofing Membrane', 'description': 'Thermoplastic roofing membrane', 'category': 'Roofing Membranes', 'unit': 'Square Meter', 'price': 520, 'cost': 440, 'reorder_level': 150, 'reorder_qty': 600},
            {'name': 'Bitumen Waterproof Membrane', 'description': 'Modified bitumen membrane', 'category': 'Roofing Membranes', 'unit': 'Roll', 'price': 2800, 'cost': 2300, 'reorder_level': 20, 'reorder_qty': 80},
            
            # Paints & Coatings
            {'name': 'Exterior Acrylic Paint', 'description': 'Weather-resistant exterior paint', 'category': 'Paints & Coatings', 'unit': 'Liter', 'price': 480, 'cost': 380, 'reorder_level': 100, 'reorder_qty': 400},
            {'name': 'Interior Emulsion Paint', 'description': 'Water-based interior paint', 'category': 'Paints & Coatings', 'unit': 'Liter', 'price': 350, 'cost': 280, 'reorder_level': 150, 'reorder_qty': 600},
            {'name': 'Primer Sealer', 'description': 'Universal primer and sealer', 'category': 'Paints & Coatings', 'unit': 'Liter', 'price': 320, 'cost': 260, 'reorder_level': 80, 'reorder_qty': 300},
            {'name': 'Wood Stain', 'description': 'Penetrating wood stain', 'category': 'Paints & Coatings', 'unit': 'Liter', 'price': 580, 'cost': 470, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Anti-Rust Paint', 'description': 'Metal protection paint', 'category': 'Paints & Coatings', 'unit': 'Liter', 'price': 620, 'cost': 500, 'reorder_level': 40, 'reorder_qty': 160},
            
            # Flooring Materials
            {'name': 'Ceramic Floor Tiles 60x60', 'description': 'Large format ceramic tiles', 'category': 'Flooring Materials', 'unit': 'Square Meter', 'price': 850, 'cost': 680, 'reorder_level': 100, 'reorder_qty': 400},
            {'name': 'Ceramic Floor Tiles 30x30', 'description': 'Standard ceramic floor tiles', 'category': 'Flooring Materials', 'unit': 'Square Meter', 'price': 650, 'cost': 520, 'reorder_level': 150, 'reorder_qty': 600},
            {'name': 'Porcelain Tiles 80x80', 'description': 'Premium porcelain floor tiles', 'category': 'Flooring Materials', 'unit': 'Square Meter', 'price': 1200, 'cost': 950, 'reorder_level': 75, 'reorder_qty': 300},
            {'name': 'Vinyl Flooring Planks', 'description': 'Luxury vinyl plank flooring', 'category': 'Flooring Materials', 'unit': 'Square Meter', 'price': 950, 'cost': 750, 'reorder_level': 200, 'reorder_qty': 800},
            {'name': 'Laminate Flooring', 'description': 'Wood-look laminate flooring', 'category': 'Flooring Materials', 'unit': 'Square Meter', 'price': 1150, 'cost': 920, 'reorder_level': 100, 'reorder_qty': 400},
            
            # Electrical Materials
            {'name': 'Copper Wire 2.5mm²', 'description': 'Single core copper wire', 'category': 'Wiring & Cables', 'unit': 'Meter', 'price': 45, 'cost': 35, 'reorder_level': 1000, 'reorder_qty': 5000},
            {'name': 'Copper Wire 4mm²', 'description': 'Heavy-duty copper wire', 'category': 'Wiring & Cables', 'unit': 'Meter', 'price': 68, 'cost': 55, 'reorder_level': 500, 'reorder_qty': 2000},
            {'name': 'Electrical Cable 3x2.5mm²', 'description': 'Three-core electrical cable', 'category': 'Wiring & Cables', 'unit': 'Meter', 'price': 125, 'cost': 95, 'reorder_level': 500, 'reorder_qty': 2000},
            {'name': 'PVC Conduit 20mm', 'description': 'Electrical conduit pipe', 'category': 'Conduits & Fittings', 'unit': 'Meter', 'price': 35, 'cost': 28, 'reorder_level': 200, 'reorder_qty': 1000},
            {'name': 'Wall Switches', 'description': 'Standard wall light switches', 'category': 'Electrical Fixtures', 'unit': 'Piece', 'price': 85, 'cost': 65, 'reorder_level': 100, 'reorder_qty': 500},
            {'name': 'Electrical Outlets', 'description': 'Standard electrical outlets', 'category': 'Electrical Fixtures', 'unit': 'Piece', 'price': 95, 'cost': 75, 'reorder_level': 80, 'reorder_qty': 400},
            {'name': 'Circuit Breakers 16A', 'description': 'Miniature circuit breakers', 'category': 'Electrical Panels', 'unit': 'Piece', 'price': 380, 'cost': 300, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Distribution Panel', 'description': 'Main electrical distribution panel', 'category': 'Electrical Panels', 'unit': 'Piece', 'price': 2800, 'cost': 2200, 'reorder_level': 10, 'reorder_qty': 40},
            
            # Plumbing Materials
            {'name': 'PVC Pipe 110mm', 'description': 'Drainage PVC pipe', 'category': 'Pipes & Fittings', 'unit': 'Meter', 'price': 185, 'cost': 150, 'reorder_level': 200, 'reorder_qty': 800},
            {'name': 'PVC Pipe 50mm', 'description': 'Water supply PVC pipe', 'category': 'Pipes & Fittings', 'unit': 'Meter', 'price': 85, 'cost': 68, 'reorder_level': 300, 'reorder_qty': 1200},
            {'name': 'PVC Pipe 25mm', 'description': 'Small diameter water pipe', 'category': 'Pipes & Fittings', 'unit': 'Meter', 'price': 45, 'cost': 35, 'reorder_level': 500, 'reorder_qty': 2000},
            {'name': 'PVC Pipe Fittings', 'description': 'Assorted PVC pipe fittings', 'category': 'Pipes & Fittings', 'unit': 'Piece', 'price': 25, 'cost': 18, 'reorder_level': 200, 'reorder_qty': 1000},
            {'name': 'Copper Pipes 15mm', 'description': 'Copper water supply pipes', 'category': 'Pipes & Fittings', 'unit': 'Meter', 'price': 285, 'cost': 230, 'reorder_level': 100, 'reorder_qty': 400},
            {'name': 'Kitchen Sink Stainless Steel', 'description': 'Double bowl kitchen sink', 'category': 'Plumbing Fixtures', 'unit': 'Piece', 'price': 4500, 'cost': 3600, 'reorder_level': 10, 'reorder_qty': 40},
            {'name': 'Bathroom Sink', 'description': 'Wall-mounted bathroom sink', 'category': 'Plumbing Fixtures', 'unit': 'Piece', 'price': 2800, 'cost': 2200, 'reorder_level': 15, 'reorder_qty': 60},
            {'name': 'Toilet Suite', 'description': 'Two-piece toilet with tank', 'category': 'Plumbing Fixtures', 'unit': 'Piece', 'price': 5200, 'cost': 4100, 'reorder_level': 8, 'reorder_qty': 32},
            {'name': 'Shower Mixer Tap', 'description': 'Wall-mounted shower mixer', 'category': 'Plumbing Fixtures', 'unit': 'Piece', 'price': 3200, 'cost': 2500, 'reorder_level': 12, 'reorder_qty': 48},
            {'name': 'Ball Valves 25mm', 'description': 'Brass ball valves', 'category': 'Valves & Controls', 'unit': 'Piece', 'price': 380, 'cost': 300, 'reorder_level': 50, 'reorder_qty': 200},
            
            # Insulation Materials
            {'name': 'Fiberglass Insulation', 'description': 'Thermal insulation batts', 'category': 'Thermal Insulation', 'unit': 'Square Meter', 'price': 285, 'cost': 230, 'reorder_level': 200, 'reorder_qty': 800},
            {'name': 'Foam Board Insulation', 'description': 'Rigid foam insulation panels', 'category': 'Thermal Insulation', 'unit': 'Square Meter', 'price': 420, 'cost': 340, 'reorder_level': 150, 'reorder_qty': 600},
            {'name': 'Reflective Insulation', 'description': 'Radiant barrier insulation', 'category': 'Thermal Insulation', 'unit': 'Square Meter', 'price': 185, 'cost': 150, 'reorder_level': 300, 'reorder_qty': 1200},
            {'name': 'Waterproof Membrane', 'description': 'Foundation waterproofing', 'category': 'Waterproof Membranes', 'unit': 'Square Meter', 'price': 680, 'cost': 550, 'reorder_level': 100, 'reorder_qty': 400},
            {'name': 'Silicone Sealant', 'description': 'Weatherproof sealant', 'category': 'Sealants & Caulks', 'unit': 'Piece', 'price': 185, 'cost': 150, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Polyurethane Sealant', 'description': 'Flexible joint sealant', 'category': 'Sealants & Caulks', 'unit': 'Piece', 'price': 220, 'cost': 180, 'reorder_level': 40, 'reorder_qty': 160},
            
            # Aggregates
            {'name': 'Coarse Sand', 'description': 'Construction grade sand', 'category': 'Aggregates', 'unit': 'Cubic Meter', 'price': 1200, 'cost': 950, 'reorder_level': 10, 'reorder_qty': 50},
            {'name': 'Fine Sand', 'description': 'Plastering grade fine sand', 'category': 'Aggregates', 'unit': 'Cubic Meter', 'price': 1350, 'cost': 1100, 'reorder_level': 8, 'reorder_qty': 40},
            {'name': 'Crushed Stone 20mm', 'description': 'Concrete aggregate', 'category': 'Aggregates', 'unit': 'Cubic Meter', 'price': 1500, 'cost': 1200, 'reorder_level': 15, 'reorder_qty': 60},
            {'name': 'Crushed Stone 10mm', 'description': 'Fine concrete aggregate', 'category': 'Aggregates', 'unit': 'Cubic Meter', 'price': 1600, 'cost': 1280, 'reorder_level': 12, 'reorder_qty': 48},
            {'name': 'Gravel', 'description': 'Drainage and base gravel', 'category': 'Aggregates', 'unit': 'Cubic Meter', 'price': 1100, 'cost': 880, 'reorder_level': 20, 'reorder_qty': 80},
            
            # Hardware & Fasteners
            {'name': 'Wood Screws 50mm', 'description': 'Self-tapping wood screws', 'category': 'Screws & Bolts', 'unit': 'Box', 'price': 285, 'cost': 230, 'reorder_level': 20, 'reorder_qty': 100},
            {'name': 'Wood Screws 75mm', 'description': 'Heavy-duty wood screws', 'category': 'Screws & Bolts', 'unit': 'Box', 'price': 380, 'cost': 300, 'reorder_level': 15, 'reorder_qty': 75},
            {'name': 'Machine Bolts M12', 'description': 'Galvanized machine bolts', 'category': 'Screws & Bolts', 'unit': 'Piece', 'price': 25, 'cost': 18, 'reorder_level': 100, 'reorder_qty': 500},
            {'name': 'Anchor Bolts', 'description': 'Concrete anchor bolts', 'category': 'Screws & Bolts', 'unit': 'Piece', 'price': 45, 'cost': 35, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Common Nails 100mm', 'description': 'Galvanized common nails', 'category': 'Nails & Staples', 'unit': 'Kilogram', 'price': 85, 'cost': 65, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Finishing Nails 50mm', 'description': 'Small head finishing nails', 'category': 'Nails & Staples', 'unit': 'Kilogram', 'price': 95, 'cost': 75, 'reorder_level': 30, 'reorder_qty': 120},
            {'name': 'Construction Adhesive', 'description': 'Heavy-duty construction adhesive', 'category': 'Construction Adhesives', 'unit': 'Piece', 'price': 185, 'cost': 150, 'reorder_level': 25, 'reorder_qty': 100},
            {'name': 'Wood Glue', 'description': 'Waterproof wood adhesive', 'category': 'Construction Adhesives', 'unit': 'Piece', 'price': 125, 'cost': 100, 'reorder_level': 30, 'reorder_qty': 120},
            
            # Doors & Windows
            {'name': 'Interior Door Solid Wood', 'description': 'Solid wood interior door', 'category': 'Doors & Windows', 'unit': 'Piece', 'price': 4500, 'cost': 3600, 'reorder_level': 10, 'reorder_qty': 40},
            {'name': 'Interior Door Hollow Core', 'description': 'Hollow core interior door', 'category': 'Doors & Windows', 'unit': 'Piece', 'price': 2800, 'cost': 2200, 'reorder_level': 15, 'reorder_qty': 60},
            {'name': 'Exterior Door Steel', 'description': 'Insulated steel entry door', 'category': 'Doors & Windows', 'unit': 'Piece', 'price': 8500, 'cost': 6800, 'reorder_level': 5, 'reorder_qty': 20},
            {'name': 'Sliding Window Aluminum', 'description': 'Aluminum sliding window', 'category': 'Doors & Windows', 'unit': 'Piece', 'price': 3800, 'cost': 3000, 'reorder_level': 8, 'reorder_qty': 32},
            {'name': 'Casement Window PVC', 'description': 'PVC casement window', 'category': 'Doors & Windows', 'unit': 'Piece', 'price': 4200, 'cost': 3350, 'reorder_level': 6, 'reorder_qty': 24},
            
            # Glass & Glazing
            {'name': 'Clear Float Glass 6mm', 'description': 'Standard clear glass sheets', 'category': 'Glass & Glazing', 'unit': 'Square Meter', 'price': 380, 'cost': 300, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Tempered Glass 8mm', 'description': 'Safety tempered glass', 'category': 'Glass & Glazing', 'unit': 'Square Meter', 'price': 680, 'cost': 550, 'reorder_level': 30, 'reorder_qty': 120},
            {'name': 'Insulated Glass Units', 'description': 'Double-pane insulated glass', 'category': 'Glass & Glazing', 'unit': 'Square Meter', 'price': 1200, 'cost': 950, 'reorder_level': 20, 'reorder_qty': 80},
            
            # Cement and Additives
            {'name': 'Portland Cement OPC 53', 'description': 'Ordinary Portland Cement Grade 53', 'category': 'Masonry Materials', 'unit': 'Bag', 'price': 420, 'cost': 380, 'reorder_level': 100, 'reorder_qty': 500},
            {'name': 'Portland Cement OPC 43', 'description': 'Ordinary Portland Cement Grade 43', 'category': 'Masonry Materials', 'unit': 'Bag', 'price': 395, 'cost': 355, 'reorder_level': 150, 'reorder_qty': 600},
            {'name': 'White Cement', 'description': 'White Portland cement for finishing', 'category': 'Masonry Materials', 'unit': 'Bag', 'price': 850, 'cost': 720, 'reorder_level': 30, 'reorder_qty': 120},
            {'name': 'Tile Adhesive', 'description': 'Ceramic tile adhesive', 'category': 'Construction Adhesives', 'unit': 'Bag', 'price': 320, 'cost': 280, 'reorder_level': 50, 'reorder_qty': 200},
            {'name': 'Grout', 'description': 'Tile grout for joints', 'category': 'Masonry Materials', 'unit': 'Bag', 'price': 185, 'cost': 150, 'reorder_level': 40, 'reorder_qty': 160},
            
            # Additional Specialty Items
            {'name': 'Expansion Joints', 'description': 'Concrete expansion joint filler', 'category': 'Sealants & Caulks', 'unit': 'Meter', 'price': 85, 'cost': 65, 'reorder_level': 100, 'reorder_qty': 400},
            {'name': 'Vapor Barrier', 'description': 'Plastic vapor barrier sheeting', 'category': 'Waterproof Membranes', 'unit': 'Square Meter', 'price': 45, 'cost': 35, 'reorder_level': 500, 'reorder_qty': 2000},
            {'name': 'Reinforcing Mesh', 'description': 'Welded wire reinforcing mesh', 'category': 'Steel Products', 'unit': 'Square Meter', 'price': 125, 'cost': 95, 'reorder_level': 200, 'reorder_qty': 800},
            {'name': 'Drainage Gravel', 'description': 'Washed gravel for drainage', 'category': 'Aggregates', 'unit': 'Cubic Meter', 'price': 1350, 'cost': 1100, 'reorder_level': 15, 'reorder_qty': 60},
            {'name': 'Landscape Fabric', 'description': 'Weed barrier landscape fabric', 'category': 'Landscaping Materials', 'unit': 'Square Meter', 'price': 25, 'cost': 18, 'reorder_level': 300, 'reorder_qty': 1200},
        ]
        
        created_materials = []
        for material_data in materials_data:
            category = categories.get(material_data['category'])
            unit = units.get(material_data['unit'])
            
            if category and unit:
                material, created = Material.objects.get_or_create(
                    name=material_data['name'],
                    defaults={
                        'description': material_data['description'],
                        'category': category,
                        'unit': unit,
                        'price_per_unit': Decimal(str(material_data['price'])),
                        'cost_per_unit': Decimal(str(material_data['cost'])),
                        'reorder_level': Decimal(str(material_data['reorder_level'])),
                        'reorder_quantity': Decimal(str(material_data['reorder_qty'])),
                        'quantity_in_stock': Decimal('0'),
                    }
                )
                created_materials.append(material)
        
        return created_materials