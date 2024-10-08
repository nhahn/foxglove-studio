#!/bin/bash
set -e

cp /foxglove/default-layout.json /foxglove/local-layout.json
if [ -n "$ROBOT_NAMESPACE" ]; then
    sed -i "s|<robot_namespace>|/$ROBOT_NAMESPACE|g" /foxglove/local-layout.json
else
    sed -i "s|<robot_namespace>||g" /foxglove/local-layout.json
fi

# Optionally override the default layout with one provided via bind mount
index_html=$(cat index.html)
replace_pattern='/*FOXGLOVE_STUDIO_DEFAULT_LAYOUT_PLACEHOLDER*/'
replace_value=$(cat /foxglove/local-layout.json)
echo "${index_html/"$replace_pattern"/$replace_value}" > index.html

# Check if ENABLE_SCRIPT1 is set to true
if [[ "$DISABLE_CACHE" == "true" ]]; then
    echo "Cache is disabled"
    # Read the content of script1.js into a variable
    script1_content=$(</disable_cache.js)

    # Escape certain characters in the content that might break sed
    escaped_script1_content=$(echo "$script1_content" | sed 's/[&/\]/\\&/g')

    # Use sed to insert the content into index.html just before </body>
    sed -i "s|<div id=\"root\"></div>|<script>\n$(echo $escaped_script1_content)\n</script>\n&|" index.html
fi

# Check if ENABLE_SCRIPT2 is set to true
if [[ "$DISABLE_INTERACTION" == "true" ]]; then
    echo "Interaction is disabled"
    # Read the content of script2.js into a variable
    script2_content=$(</disable_interaction.js)

    # Escape certain characters in the content that might break sed
    escaped_script2_content=$(echo "$script2_content" | sed 's/[&/\]/\\&/g')

    # Use sed to insert the content into index.html just before </body>
    sed -i "s|<div id=\"root\"></div>|<script>\n$(echo $escaped_script2_content)\n</script>\n&|" index.html
fi

# Continue executing the CMD
exec "$@"
