#!/bin/bash

# Fix Icon Imports in SvelteKit Client
# This script replaces @icons/ imports with lucide-svelte imports

echo "🔧 Fixing icon imports in service-client..."

# Fix Timeline.svelte
if [ -f "src/lib/components/Timeline.svelte" ]; then
    echo "Fixing Timeline.svelte..."
    sed -i.bak 's|import Check from "@icons/check.svelte";|import { Check } from "lucide-svelte";|g' src/lib/components/Timeline.svelte
    sed -i.bak 's|import Plus from "@icons/plus.svelte";|import { Plus } from "lucide-svelte";|g' src/lib/components/Timeline.svelte
    # Combine multiple imports if they exist
    sed -i.bak 's|import { Check } from "lucide-svelte";\nimport { Plus } from "lucide-svelte";|import { Check, Plus } from "lucide-svelte";|g' src/lib/components/Timeline.svelte
    rm src/lib/components/Timeline.svelte.bak
fi

# Find all files with @icons imports and fix them
echo "Searching for all @icons imports..."

# Common icon mappings
declare -A ICON_MAP=(
    ["check"]="Check"
    ["plus"]="Plus"
    ["x"]="X"
    ["loader-circle"]="Loader2"
    ["loader"]="Loader"
    ["chevron-down"]="ChevronDown"
    ["chevron-up"]="ChevronUp"
    ["chevron-left"]="ChevronLeft"
    ["chevron-right"]="ChevronRight"
    ["arrow-left"]="ArrowLeft"
    ["arrow-right"]="ArrowRight"
    ["menu"]="Menu"
    ["search"]="Search"
    ["user"]="User"
    ["settings"]="Settings"
    ["home"]="Home"
    ["file"]="File"
    ["folder"]="Folder"
    ["trash"]="Trash2"
    ["edit"]="Edit"
    ["save"]="Save"
    ["download"]="Download"
    ["upload"]="Upload"
)

# Find all .svelte and .ts files with @icons imports
find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; | while read -r file; do
    echo "Processing: $file"
    
    # Extract icon names and build import statement
    icons=$(grep 'import.*from.*"@icons/' "$file" | sed 's/.*from.*"@icons\/\([^"]*\)\.svelte".*/\1/' | tr '\n' ' ')
    
    if [ ! -z "$icons" ]; then
        # Build lucide import list
        lucide_imports=""
        for icon in $icons; do
            # Convert kebab-case to PascalCase
            pascal_icon=$(echo "$icon" | sed 's/-\([a-z]\)/\U\1/g' | sed 's/^./\U&/')
            
            # Use mapping if exists, otherwise use converted name
            if [ "${ICON_MAP[$icon]}" ]; then
                lucide_icon="${ICON_MAP[$icon]}"
            else
                lucide_icon="$pascal_icon"
            fi
            
            if [ -z "$lucide_imports" ]; then
                lucide_imports="$lucide_icon"
            else
                lucide_imports="$lucide_imports, $lucide_icon"
            fi
            
            # Replace the import in the file
            sed -i.bak "s|import .* from [\"']@icons/${icon}\.svelte[\"'];*||g" "$file"
        done
        
        # Add the combined lucide import at the top of the script section
        if [ ! -z "$lucide_imports" ]; then
            # Check if file already has lucide-svelte import
            if grep -q "from \"lucide-svelte\"" "$file"; then
                # Merge with existing import
                echo "Merging with existing lucide-svelte import in $file"
            else
                # Add new import after <script> tag
                sed -i.bak "s|<script>|<script>\n\timport { $lucide_imports } from \"lucide-svelte\";|" "$file"
                sed -i.bak "s|<script lang=\"ts\">|<script lang=\"ts\">\n\timport { $lucide_imports } from \"lucide-svelte\";|" "$file"
            fi
        fi
        
        # Clean up backup files
        rm -f "${file}.bak"
    fi
done

echo "✅ Icon imports fixed!"

# Verify no @icons imports remain
remaining=$(find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; | wc -l)
if [ "$remaining" -gt 0 ]; then
    echo "⚠️  Warning: $remaining files still contain @icons imports:"
    find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \;
else
    echo "✅ All @icons imports have been replaced!"
fi
