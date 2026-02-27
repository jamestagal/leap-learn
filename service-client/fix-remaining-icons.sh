#!/bin/bash

# Fix all remaining @icons imports in the identified files
echo "🔧 Fixing remaining @icons imports..."

# Function to convert kebab-case to PascalCase
to_pascal_case() {
    echo "$1" | sed 's/-\([a-z]\)/\U\1/g' | sed 's/^./\U&/'
}

# Icon name mappings for common icons
declare -A ICON_MAP=(
    ["chevron-down"]="ChevronDown"
    ["chevron-up"]="ChevronUp"
    ["chevron-left"]="ChevronLeft"
    ["chevron-right"]="ChevronRight"
    ["star"]="Star"
    ["star-filled"]="Star"
    ["plus"]="Plus"
    ["minus"]="Minus"
    ["calendar"]="Calendar"
    ["check"]="Check"
    ["x"]="X"
    ["menu"]="Menu"
    ["filter"]="Filter"
    ["search"]="Search"
    ["user"]="User"
    ["avatar"]="UserCircle"
    ["arrow-down"]="ArrowDown"
    ["arrow-up"]="ArrowUp"
    ["arrow-left"]="ArrowLeft"
    ["arrow-right"]="ArrowRight"
)

# Function to fix imports in a file
fix_file_imports() {
    local file=$1
    echo "Processing: $file"
    
    # Create a temporary file
    local temp_file="${file}.tmp"
    
    # Read the file and collect all icon imports
    local icons=()
    while IFS= read -r line; do
        if [[ $line =~ import[[:space:]]+([^[:space:]]+)[[:space:]]+from[[:space:]]+[\"\']\@icons/([^\"\']+)\.svelte[\"\'] ]]; then
            local import_name="${BASH_REMATCH[1]}"
            local icon_file="${BASH_REMATCH[2]}"
            
            # Map icon name or use PascalCase conversion
            if [[ -n "${ICON_MAP[$icon_file]}" ]]; then
                icons+=("${ICON_MAP[$icon_file]}")
            else
                icons+=("$(to_pascal_case "$icon_file")")
            fi
        fi
    done < "$file"
    
    # If we found icons, process the file
    if [ ${#icons[@]} -gt 0 ]; then
        # Create the lucide import line
        local lucide_import="import { $(IFS=', '; echo "${icons[*]}") } from \"lucide-svelte\";"
        
        # Process the file
        local in_script=false
        local lucide_added=false
        
        while IFS= read -r line; do
            # Check if we're entering a script tag
            if [[ $line =~ \<script ]]; then
                in_script=true
                echo "$line" >> "$temp_file"
                
                # Add lucide import right after script tag
                if [ "$lucide_added" = false ]; then
                    echo "	$lucide_import" >> "$temp_file"
                    lucide_added=true
                fi
                continue
            fi
            
            # Skip @icons import lines
            if [[ $line =~ import.*from.*[\"\']@icons/ ]]; then
                continue
            fi
            
            echo "$line" >> "$temp_file"
        done < "$file"
        
        # Replace the original file
        mv "$temp_file" "$file"
        echo "✅ Fixed: $file"
    else
        echo "⏭️  No @icons imports in: $file"
    fi
}

# Fix Dropdown.svelte
if [ -f "src/lib/components/Dropdown.svelte" ]; then
    fix_file_imports "src/lib/components/Dropdown.svelte"
fi

# Fix Accordion.svelte
if [ -f "src/lib/components/Accordion.svelte" ]; then
    fix_file_imports "src/lib/components/Accordion.svelte"
fi

# Fix ProductCard.svelte
if [ -f "src/lib/components/ProductCard.svelte" ]; then
    fix_file_imports "src/lib/components/ProductCard.svelte"
fi

# Fix Calendar.svelte
if [ -f "src/lib/components/Calendar.svelte" ]; then
    fix_file_imports "src/lib/components/Calendar.svelte"
fi

# Fix SideNavigation.svelte
if [ -f "src/lib/components/SideNavigation.svelte" ]; then
    fix_file_imports "src/lib/components/SideNavigation.svelte"
fi

# Fix Number.svelte
if [ -f "src/lib/components/Number.svelte" ]; then
    fix_file_imports "src/lib/components/Number.svelte"
fi

# Fix Ratings.svelte
if [ -f "src/lib/components/Ratings.svelte" ]; then
    fix_file_imports "src/lib/components/Ratings.svelte"
fi

echo ""
echo "🔍 Verifying all fixes..."
remaining=$(find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; 2>/dev/null | wc -l)

if [ "$remaining" -eq 0 ]; then
    echo "✅ All @icons imports have been successfully replaced!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Run 'npm run check' to verify no TypeScript errors"
    echo "2. Run 'npm run dev' to test the application"
    echo "3. Commit the changes"
else
    echo "⚠️  Still found $remaining files with @icons imports:"
    find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; 2>/dev/null
fi
