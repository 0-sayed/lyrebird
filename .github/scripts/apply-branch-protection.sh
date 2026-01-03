#!/bin/bash

# ========================================
# Apply Branch Protection Rules
# ========================================
# Uses GitHub CLI to apply protection rules from JSON files
# 
# Usage:
#   ./apply-branch-protection.sh main
#   ./apply-branch-protection.sh develop
#   ./apply-branch-protection.sh all

set -e

OWNER="0-sayed"
REPO="lyrebird"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

apply_protection() {
    local branch=$1
    local config_file="$CONFIG_DIR/branch-protection-${branch}.json"
    
    if [ ! -f "$config_file" ]; then
        echo -e "${RED}Error: Config file not found: $config_file${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Applying protection rules to branch: $branch${NC}"
    
    # Apply ruleset using GitHub API (new rulesets system)
    gh api \
        --method POST \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/$OWNER/$REPO/rulesets" \
        --input "$config_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully applied protection rules to $branch${NC}"
    else
        echo -e "${RED}✗ Failed to apply protection rules to $branch${NC}"
        return 1
    fi
}

# Main script logic
case "$1" in
    main)
        apply_protection "main"
        ;;
    develop)
        apply_protection "develop"
        ;;
    all)
        apply_protection "main"
        apply_protection "develop"
        ;;
    *)
        echo "Usage: $0 {main|develop|all}"
        echo ""
        echo "Examples:"
        echo "  $0 main     - Apply protection to main branch"
        echo "  $0 develop  - Apply protection to develop branch"
        echo "  $0 all      - Apply protection to all branches"
        exit 1
        ;;
esac

echo -e "${GREEN}Done!${NC}"
