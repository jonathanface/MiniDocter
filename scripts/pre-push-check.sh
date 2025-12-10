#!/bin/bash

# Pre-push validation script
# Run this locally to check if your code will pass CI before pushing

set -e  # Exit on first error

echo "🔍 Running pre-push checks..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Not in the project root directory!"
    exit 1
fi

# Check 1: TypeScript type checking
print_section "1. TypeScript Type Check"
if npx tsc --noEmit; then
    print_success "TypeScript type check passed"
else
    print_error "TypeScript type check failed"
    exit 1
fi

# Check 2: Run tests
print_section "2. Running Tests"
if npm test -- --watchAll=false; then
    print_success "All tests passed"
else
    print_error "Tests failed"
    exit 1
fi

# Check 3: Run tests with coverage
print_section "3. Running Tests with Coverage"
if npm run test:coverage -- --watchAll=false; then
    print_success "Tests with coverage passed"

    # Extract and display coverage summary
    if [ -f "coverage/coverage-summary.json" ]; then
        echo ""
        echo "Coverage Summary:"
        node -e "
            const coverage = require('./coverage/coverage-summary.json');
            const total = coverage.total;
            console.log('  Statements:', total.statements.pct + '%');
            console.log('  Branches:  ', total.branches.pct + '%');
            console.log('  Functions: ', total.functions.pct + '%');
            console.log('  Lines:     ', total.lines.pct + '%');
        "
    fi
else
    print_error "Tests with coverage failed"
    exit 1
fi

# Check 4: ESLint (if configured)
print_section "4. ESLint Check"
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]; then
    if npx eslint . --ext .ts,.tsx,.js,.jsx; then
        print_success "ESLint check passed"
    else
        print_error "ESLint check failed"
        exit 1
    fi
else
    print_warning "ESLint not configured, skipping..."
fi

# Check 5: Check for console.log statements (optional warning)
print_section "5. Code Quality Checks"
if git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -n 'console\.log' 2>/dev/null; then
    print_warning "Found console.log statements in staged files"
    echo "  Consider removing them before committing"
else
    print_success "No console.log statements found"
fi

# Check 6: Check for TODO/FIXME comments (optional warning)
if git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -n 'TODO\|FIXME' 2>/dev/null; then
    print_warning "Found TODO/FIXME comments in staged files"
else
    print_success "No TODO/FIXME comments found"
fi

# Final summary
print_section "✅ All Checks Passed!"
echo ""
echo "Your code is ready to push and should pass CI checks."
echo ""
echo "To push your changes, run:"
echo "  git push"
echo ""
