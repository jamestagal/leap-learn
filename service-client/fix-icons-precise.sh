#!/bin/bash

# Precise fix for all @icons imports based on actual usage
echo "🔧 Fixing all @icons imports with exact mappings..."

# Fix Dropdown.svelte
echo "Fixing Dropdown.svelte..."
if [ -f "src/lib/components/Dropdown.svelte" ]; then
    sed -i.bak 's|import ChevronsUpDown from "@icons/chevrons-up-down.svelte";|import { ChevronsUpDown } from "lucide-svelte";|g' src/lib/components/Dropdown.svelte
    rm -f src/lib/components/Dropdown.svelte.bak
    echo "✅ Fixed Dropdown.svelte"
fi

# Fix Accordion.svelte
echo "Fixing Accordion.svelte..."
if [ -f "src/lib/components/Accordion.svelte" ]; then
    # Replace individual imports
    sed -i.bak 's|import ChevronDown from "@icons/chevron-down.svelte";||g' src/lib/components/Accordion.svelte
    sed -i.bak 's|import ChevronRight from "@icons/chevron-right.svelte";||g' src/lib/components/Accordion.svelte
    
    # Add combined lucide import after <script> tag
    sed -i.bak 's|<script>|<script>\n\timport { ChevronDown, ChevronRight } from "lucide-svelte";|' src/lib/components/Accordion.svelte
    sed -i.bak 's|<script lang="ts">|<script lang="ts">\n\timport { ChevronDown, ChevronRight } from "lucide-svelte";|' src/lib/components/Accordion.svelte
    
    # Clean up any duplicate imports
    awk '!seen[$0]++' src/lib/components/Accordion.svelte > src/lib/components/Accordion.svelte.tmp
    mv src/lib/components/Accordion.svelte.tmp src/lib/components/Accordion.svelte
    rm -f src/lib/components/Accordion.svelte.bak
    echo "✅ Fixed Accordion.svelte"
fi

# Fix ProductCard.svelte
echo "Fixing ProductCard.svelte..."
if [ -f "src/lib/components/ProductCard.svelte" ]; then
    sed -i.bak 's|import ArrowRight from "@icons/arrow-right.svelte";|import { ArrowRight } from "lucide-svelte";|g' src/lib/components/ProductCard.svelte
    rm -f src/lib/components/ProductCard.svelte.bak
    echo "✅ Fixed ProductCard.svelte"
fi

# Fix Calendar.svelte
echo "Fixing Calendar.svelte..."
if [ -f "src/lib/components/Calendar.svelte" ]; then
    # Replace individual imports
    sed -i.bak 's|import ChevronLeft from "@icons/chevron-left.svelte";||g' src/lib/components/Calendar.svelte
    sed -i.bak 's|import ChevronRight from "@icons/chevron-right.svelte";||g' src/lib/components/Calendar.svelte
    
    # Add combined lucide import
    sed -i.bak 's|<script>|<script>\n\timport { ChevronLeft, ChevronRight } from "lucide-svelte";|' src/lib/components/Calendar.svelte
    sed -i.bak 's|<script lang="ts">|<script lang="ts">\n\timport { ChevronLeft, ChevronRight } from "lucide-svelte";|' src/lib/components/Calendar.svelte
    
    # Clean up duplicates
    awk '!seen[$0]++' src/lib/components/Calendar.svelte > src/lib/components/Calendar.svelte.tmp
    mv src/lib/components/Calendar.svelte.tmp src/lib/components/Calendar.svelte
    rm -f src/lib/components/Calendar.svelte.bak
    echo "✅ Fixed Calendar.svelte"
fi

# Fix SideNavigation.svelte
echo "Fixing SideNavigation.svelte..."
if [ -f "src/lib/components/SideNavigation.svelte" ]; then
    # Replace individual imports
    sed -i.bak 's|import Menu from "@icons/menu.svelte";||g' src/lib/components/SideNavigation.svelte
    sed -i.bak 's|import X from "@icons/x.svelte";||g' src/lib/components/SideNavigation.svelte
    
    # Add combined lucide import
    sed -i.bak 's|<script>|<script>\n\timport { Menu, X } from "lucide-svelte";|' src/lib/components/SideNavigation.svelte
    sed -i.bak 's|<script lang="ts">|<script lang="ts">\n\timport { Menu, X } from "lucide-svelte";|' src/lib/components/SideNavigation.svelte
    
    # Clean up duplicates
    awk '!seen[$0]++' src/lib/components/SideNavigation.svelte > src/lib/components/SideNavigation.svelte.tmp
    mv src/lib/components/SideNavigation.svelte.tmp src/lib/components/SideNavigation.svelte
    rm -f src/lib/components/SideNavigation.svelte.bak
    echo "✅ Fixed SideNavigation.svelte"
fi

# Fix Number.svelte
echo "Fixing Number.svelte..."
if [ -f "src/lib/components/Number.svelte" ]; then
    # Replace individual imports
    sed -i.bak 's|import Plus from "@icons/plus.svelte";||g' src/lib/components/Number.svelte
    sed -i.bak 's|import Minus from "@icons/minus.svelte";||g' src/lib/components/Number.svelte
    
    # Add combined lucide import
    sed -i.bak 's|<script>|<script>\n\timport { Plus, Minus } from "lucide-svelte";|' src/lib/components/Number.svelte
    sed -i.bak 's|<script lang="ts">|<script lang="ts">\n\timport { Plus, Minus } from "lucide-svelte";|' src/lib/components/Number.svelte
    
    # Clean up duplicates
    awk '!seen[$0]++' src/lib/components/Number.svelte > src/lib/components/Number.svelte.tmp
    mv src/lib/components/Number.svelte.tmp src/lib/components/Number.svelte
    rm -f src/lib/components/Number.svelte.bak
    echo "✅ Fixed Number.svelte"
fi

# Fix Ratings.svelte
echo "Fixing Ratings.svelte..."
if [ -f "src/lib/components/Ratings.svelte" ]; then
    # UserRound in lucide-svelte is actually UserCircle
    sed -i.bak 's|import UserRound from "@icons/user-round.svelte";|import { UserCircle as UserRound } from "lucide-svelte";|g' src/lib/components/Ratings.svelte
    rm -f src/lib/components/Ratings.svelte.bak
    echo "✅ Fixed Ratings.svelte"
fi

echo ""
echo "🔍 Final verification..."
remaining=$(find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; 2>/dev/null)

if [ -z "$remaining" ]; then
    echo "✅ SUCCESS! All @icons imports have been replaced with lucide-svelte!"
    echo ""
    echo "📋 Summary of changes:"
    echo "  - Dropdown.svelte: ChevronsUpDown"
    echo "  - Accordion.svelte: ChevronDown, ChevronRight"
    echo "  - ProductCard.svelte: ArrowRight"
    echo "  - Calendar.svelte: ChevronLeft, ChevronRight"
    echo "  - SideNavigation.svelte: Menu, X"
    echo "  - Number.svelte: Plus, Minus"
    echo "  - Ratings.svelte: UserCircle (as UserRound)"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Run 'npm run check' to verify TypeScript compilation"
    echo "2. Run 'npm run dev' to test the application"
    echo "3. Test each component to ensure icons render correctly"
    echo "4. Commit changes: git add -A && git commit -m 'fix: replace @icons imports with lucide-svelte'"
else
    echo "⚠️  Some files still have @icons imports:"
    echo "$remaining"
    echo ""
    echo "These may need manual inspection and fixing."
fi

# Run TypeScript check
echo ""
echo "🔬 Running TypeScript check..."
cd /Users/benjaminwaller/Projects/GoFast/webkit/service-client
npm run check 2>&1 | head -20

echo ""
echo "✅ Icon import fix complete!"
