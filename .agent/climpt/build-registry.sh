#!/bin/bash

# Build Climpt Command Registry
# This script analyzes prompt files and generates a command registry

echo "Building Climpt Command Registry..."

# Initialize output file
cat > .agent/climpt/tools-list.md << 'EOF'
# Climpt Available Commands List

Generated on: $(date)

EOF

# Process each command directory
for command_dir in .agent/climpt/prompts/*/; do
    if [ -d "$command_dir" ]; then
        command_name=$(basename "$command_dir")
        echo "Processing climpt-$command_name..."
        
        # Start command section
        echo "## climpt-$command_name" >> .agent/climpt/tools-list.md
        echo "" >> .agent/climpt/tools-list.md
        echo "|directive|layer|input(-i)|adaptation(-a)|input_text_file(-f)|input_text(STDIN)|destination(-o)|" >> .agent/climpt/tools-list.md
        echo "|---|---|---|---|---|---|---|" >> .agent/climpt/tools-list.md
        
        # Find all prompt files for this command
        find "$command_dir" -name "f_*.md" -type f | while read -r prompt_file; do
            # Extract path components
            rel_path=${prompt_file#.agent/climpt/prompts/}
            directive=$(echo "$rel_path" | cut -d'/' -f2)
            layer=$(echo "$rel_path" | cut -d'/' -f3)
            filename=$(basename "$prompt_file")
            
            # Extract input and adaptation from filename
            # Format: f_<input>_<adaptation>.md or f_<input>.md
            base_name=${filename#f_}
            base_name=${base_name%.md}
            
            if [[ "$base_name" == *"_"* ]]; then
                input_part=$(echo "$base_name" | cut -d'_' -f1)
                adaptation_part=$(echo "$base_name" | cut -d'_' -f2-)
            else
                input_part="$base_name"
                adaptation_part="default"
            fi
            
            # Check for template variables in file
            has_input_file="-"
            has_stdin="-"
            has_destination="-"
            
            if grep -q "{input_text_file}" "$prompt_file" 2>/dev/null; then
                has_input_file="✓"
            fi
            
            if grep -q "{input_text}" "$prompt_file" 2>/dev/null; then
                has_stdin="✓"
            fi
            
            if grep -q "{destination_path}" "$prompt_file" 2>/dev/null; then
                has_destination="✓"
            fi
            
            # Add table row
            echo "| $directive | $layer | $input_part | $adaptation_part | $has_input_file | $has_stdin | $has_destination |" >> .agent/climpt/tools-list.md
        done
        
        echo "" >> .agent/climpt/tools-list.md
        
        # Add command details from frontmatter
        find "$command_dir" -name "f_*.md" -type f | while read -r prompt_file; do
            # Extract frontmatter if exists
            if head -n 1 "$prompt_file" | grep -q "^---$"; then
                # Extract frontmatter section
                sed -n '/^---$/,/^---$/p' "$prompt_file" | sed '1d;$d' > /tmp/frontmatter.tmp
                
                if [ -s /tmp/frontmatter.tmp ]; then
                    title=$(grep "^title:" /tmp/frontmatter.tmp | sed 's/^title: //')
                    description=$(grep "^description:" /tmp/frontmatter.tmp | sed 's/^description: //')
                    usage=$(grep "^usage:" /tmp/frontmatter.tmp | sed 's/^usage: //')
                    
                    rel_path=${prompt_file#.agent/climpt/prompts/}
                    directive=$(echo "$rel_path" | cut -d'/' -f2)
                    layer=$(echo "$rel_path" | cut -d'/' -f3)
                    
                    if [ -n "$title" ] || [ -n "$description" ]; then
                        echo "**climpt-$command_name $directive $layer**:" >> .agent/climpt/tools-list.md
                        [ -n "$title" ] && echo "$title" >> .agent/climpt/tools-list.md
                        [ -n "$description" ] && echo "$description" >> .agent/climpt/tools-list.md
                        [ -n "$usage" ] && echo "Usage: $usage" >> .agent/climpt/tools-list.md
                        echo "" >> .agent/climpt/tools-list.md
                    fi
                fi
                
                rm -f /tmp/frontmatter.tmp
            fi
        done
    fi
done

echo "Registry built successfully at .agent/climpt/tools-list.md"