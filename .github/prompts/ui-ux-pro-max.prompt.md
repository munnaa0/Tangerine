---
agent: "agent"
description: "Use when designing or improving UI/UX for web or mobile projects with opinionated, production-ready guidance."
---

# ui-ux-pro-max

Comprehensive design workflow for web and mobile applications using the local dataset and scripts in `.github/prompts/ui-ux-pro-max/`.

## Prerequisites

Check Python:

```bash
python --version
```

Install if missing (Windows):

```powershell
winget install Python.Python.3.12
```

## Workflow

When user requests UI/UX work (design, build, create, implement, review, fix, improve):

1. Analyze request for product type, style, industry, and stack.
2. Run design system generation first.
3. Optionally run domain and stack-specific searches.
4. Implement and verify visual quality/accessibility.

## Step 1: Generate Design System (Required)

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system -p "Project Name"
```

Persist design system across pages:

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
python .github/prompts/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

## Step 2: Domain Searches (Optional)

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> -n <max_results>
```

Domains: `product`, `style`, `typography`, `color`, `landing`, `chart`, `ux`, `react`, `web`, `prompt`

## Step 3: Stack Guidance

Default stack is `html-tailwind` when user does not specify one.

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<keyword>" --stack html-tailwind
```

Stacks: `html-tailwind`, `react`, `nextjs`, `vue`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `jetpack-compose`

## Output Format

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system
python .github/prompts/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

## Quality Rules

- Use SVG icons, not emoji icons.
- Ensure clickable items show pointer and hover feedback.
- Keep strong contrast in light mode.
- Maintain consistent spacing and container widths.
