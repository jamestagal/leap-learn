#!/bin/bash

# Final fix for ProductCard.svelte
echo "🔧 Fixing remaining icons in ProductCard.svelte..."

if [ -f "src/lib/components/ProductCard.svelte" ]; then
    # Create a backup
    cp src/lib/components/ProductCard.svelte src/lib/components/ProductCard.svelte.backup
    
    # Remove all @icons imports
    sed -i '' '/import.*@icons/d' src/lib/components/ProductCard.svelte
    
    # Add the combined lucide import after the script tag
    # First, check if there's already a lucide import
    if grep -q "from \"lucide-svelte\"" src/lib/components/ProductCard.svelte; then
        # Update existing lucide import to include all needed icons
        sed -i '' 's/import { ArrowRight } from "lucide-svelte";/import { ArrowRight, Check, X } from "lucide-svelte";/' src/lib/components/ProductCard.svelte
    else
        # Add new lucide import after script tag
        sed -i '' 's/<script>/&\
	import { ArrowRight, Check, X } from "lucide-svelte";/' src/lib/components/ProductCard.svelte
        sed -i '' 's/<script lang="ts">/&\
	import { ArrowRight, Check, X } from "lucide-svelte";/' src/lib/components/ProductCard.svelte
    fi
    
    echo "✅ Fixed ProductCard.svelte"
fi

# Final verification
echo ""
echo "🔍 Final check for @icons imports..."
remaining=$(find src -type f \( -name "*.svelte" -o -name "*.ts" \) -exec grep -l "@icons" {} \; 2>/dev/null)

if [ -z "$remaining" ]; then
    echo "✅ SUCCESS! All @icons imports have been completely removed!"
    
    # Remove backup if successful
    rm -f src/lib/components/ProductCard.svelte.backup
else
    echo "⚠️  Still found @icons imports in:"
    echo "$remaining"
    
    # Restore backup if failed
    if [ -f "src/lib/components/ProductCard.svelte.backup" ]; then
        mv src/lib/components/ProductCard.svelte.backup src/lib/components/ProductCard.svelte
        echo "Restored backup of ProductCard.svelte"
    fi
fi

echo ""
echo "✅ All icon imports should now be fixed!"
echo ""
echo "🎯 Remaining TypeScript issues to fix manually:"
echo "1. src/lib/server/validation.ts:32 - ZodError type issue"
echo "2. src/lib/config/api.ts:107 - process.env['NODE_ENV'] access"
echo ""
echo "These are unrelated to the icon imports and need separate fixes."
