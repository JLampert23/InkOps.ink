# API Documentation Tools Setup Guide

This guide helps you set up automated API documentation tools for InkOps.

## Table of Contents

1. [Swagger UI](#swagger-ui)
2. [Redoc](#redoc)
3. [Postman](#postman)
4. [Docusaurus](#docusaurus)
5. [OpenAPI Generator](#openapi-generator)

---

## Swagger UI

Interactive API documentation with live testing capability.

### Installation

```bash
npm install swagger-ui-express --save
```

### Setup (Express.js)

Create `docs/swagger.js`:

```javascript
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const express = require('express');

const app = express();
const swaggerDocument = YAML.load('./openapi.yaml');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "InkOps API Documentation"
}));

app.listen(3000, () => {
  console.log('API docs available at http://localhost:3000/api-docs');
});
```

### Run

```bash
node docs/swagger.js
```

Visit `http://localhost:3000/api-docs`

### Static HTML Generation

```bash
npx swagger-ui-cli bundle openapi.yaml -o docs/api-docs.html
```

---

## Redoc

Clean, responsive API documentation.

### Installation

```bash
npm install redoc-cli -g
```

### Generate Static HTML

```bash
redoc-cli bundle openapi.yaml -o docs/redoc.html --title "InkOps API Documentation"
```

### Serve Locally

```bash
redoc-cli serve openapi.yaml --watch
```

Visit `http://localhost:8080`

### Deploy to GitHub Pages

Create `.github/workflows/docs.yml`:

```yaml
name: Deploy API Docs

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Generate API docs
        run: |
          npm install -g redoc-cli
          redoc-cli bundle openapi.yaml -o docs/index.html

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
```

---

## Postman

API testing and collaboration platform.

### Import OpenAPI Spec

1. Open Postman
2. Click "Import" button
3. Select `openapi.yaml`
4. Postman will auto-generate collection

### Export Collection

```bash
# Using Postman CLI
postman collection export "InkOps API" -o postman_collection.json
```

### Generate Collection from OpenAPI

```bash
npm install -g openapi-to-postmanv2

openapi2postmanv2 -s openapi.yaml -o postman_collection.json -p
```

### Run Collection Tests

```bash
npm install -g newman

newman run postman_collection.json \
  --environment production.json \
  --reporters cli,json,html \
  --reporter-html-export newman-report.html
```

### Share Collection

Create `postman_environment.json`:

```json
{
  "name": "InkOps Production",
  "values": [
    {
      "key": "base_url",
      "value": "https://your-project.supabase.co/functions/v1",
      "enabled": true
    },
    {
      "key": "jwt_token",
      "value": "",
      "enabled": true
    }
  ]
}
```

---

## Docusaurus

Full-featured documentation website.

### Installation

```bash
npx create-docusaurus@latest api-docs classic
cd api-docs
```

### Install OpenAPI Plugin

```bash
npm install docusaurus-plugin-openapi-docs
npm install docusaurus-theme-openapi-docs
```

### Configure

Edit `docusaurus.config.js`:

```javascript
module.exports = {
  title: 'InkOps API Documentation',
  tagline: 'Print shop management and automation',
  url: 'https://docs.inkops.com',
  baseUrl: '/',

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          docLayoutComponent: "@theme/DocPage",
          docItemComponent: "@theme/ApiItem"
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: "api",
        docsPluginId: "classic",
        config: {
          inkops: {
            specPath: "../openapi.yaml",
            outputDir: "docs/api",
            sidebarOptions: {
              groupPathsBy: "tag",
            },
          },
        },
      },
    ],
  ],

  themes: ["docusaurus-theme-openapi-docs"],
};
```

### Generate API Docs

```bash
npm run docusaurus gen-api-docs all
```

### Build and Serve

```bash
npm run build
npm run serve
```

### Deploy

```bash
# Vercel
npm install -g vercel
vercel --prod

# Netlify
npm install -g netlify-cli
netlify deploy --prod

# GitHub Pages
npm run deploy
```

---

## OpenAPI Generator

Generate client SDKs and server stubs.

### Installation

```bash
npm install @openapitools/openapi-generator-cli -g
```

### Generate TypeScript Client

```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o sdk/typescript \
  --additional-properties=npmName=@inkops/api-client,npmVersion=1.0.0
```

### Generate Python Client

```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o sdk/python \
  --additional-properties=packageName=inkops_api,projectName=inkops-api-client
```

### Generate Go Client

```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g go \
  -o sdk/go \
  --additional-properties=packageName=inkops
```

### Generate API Documentation

```bash
# HTML2 documentation
openapi-generator-cli generate \
  -i openapi.yaml \
  -g html2 \
  -o docs/html

# Markdown documentation
openapi-generator-cli generate \
  -i openapi.yaml \
  -g markdown \
  -o docs/markdown
```

### Available Generators

```bash
# List all available generators
openapi-generator-cli list

# Popular generators:
# - typescript-fetch
# - typescript-axios
# - javascript
# - python
# - go
# - java
# - php
# - ruby
# - rust
# - swift
```

---

## Additional Tools

### 1. Stoplight Studio

Visual OpenAPI editor.

```bash
npm install -g @stoplight/spectral-cli

# Validate OpenAPI spec
spectral lint openapi.yaml
```

### 2. API Blueprint

Alternative to OpenAPI.

```bash
npm install -g aglio

# Generate HTML from API Blueprint
aglio -i api.apib -o docs/api.html --theme-template triple
```

### 3. RapiDoc

Fast, customizable API documentation.

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
</head>
<body>
  <rapi-doc
    spec-url="openapi.yaml"
    render-style="read"
    theme="dark"
    primary-color="#667eea"
  ></rapi-doc>
</body>
</html>
```

### 4. Insomnia

Alternative to Postman.

```bash
# Export Insomnia collection
insomnia export > insomnia_collection.json

# Import OpenAPI spec
# File > Import > openapi.yaml
```

---

## Automation Scripts

### Auto-update Documentation

Create `scripts/update-docs.sh`:

```bash
#!/bin/bash

echo "Updating API documentation..."

# Validate OpenAPI spec
echo "Validating OpenAPI spec..."
spectral lint openapi.yaml

# Generate Redoc
echo "Generating Redoc..."
redoc-cli bundle openapi.yaml -o docs/redoc.html

# Generate Swagger UI
echo "Generating Swagger UI..."
npx swagger-ui-cli bundle openapi.yaml -o docs/swagger.html

# Generate TypeScript SDK
echo "Generating TypeScript SDK..."
openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o sdk/typescript

# Generate Postman collection
echo "Generating Postman collection..."
openapi2postmanv2 -s openapi.yaml -o postman_collection.json

echo "Documentation updated successfully!"
```

Make it executable:

```bash
chmod +x scripts/update-docs.sh
```

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Validate OpenAPI spec before commit
spectral lint openapi.yaml

if [ $? -ne 0 ]; then
  echo "OpenAPI validation failed. Please fix errors before committing."
  exit 1
fi

echo "OpenAPI validation passed."
```

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/api-docs.yml`:

```yaml
name: API Documentation

on:
  push:
    branches: [ main ]
    paths:
      - 'openapi.yaml'
      - 'docs/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate OpenAPI
        run: |
          npm install -g @stoplight/spectral-cli
          spectral lint openapi.yaml

  generate:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Generate documentation
        run: |
          npm install -g redoc-cli
          redoc-cli bundle openapi.yaml -o docs/index.html

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs

  sdk:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Generate SDKs
        run: |
          npm install -g @openapitools/openapi-generator-cli

          # TypeScript
          openapi-generator-cli generate \
            -i openapi.yaml \
            -g typescript-fetch \
            -o sdk/typescript

          # Python
          openapi-generator-cli generate \
            -i openapi.yaml \
            -g python \
            -o sdk/python

      - name: Publish to npm
        if: github.ref == 'refs/heads/main'
        run: |
          cd sdk/typescript
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Best Practices

1. **Keep OpenAPI spec up-to-date**: Update `openapi.yaml` with every API change
2. **Version your API**: Use semantic versioning in info.version
3. **Validate before commit**: Use pre-commit hooks to validate spec
4. **Auto-generate SDKs**: Generate client libraries for popular languages
5. **Interactive testing**: Provide Swagger UI for developers to test endpoints
6. **Multiple formats**: Offer both Swagger UI and Redoc for different preferences
7. **CI/CD integration**: Auto-deploy documentation on changes
8. **Changelog**: Maintain detailed changelog of API changes
9. **Examples**: Include realistic request/response examples
10. **Error codes**: Document all possible error codes and responses

---

## Troubleshooting

### OpenAPI Validation Errors

```bash
# Detailed validation
spectral lint openapi.yaml --verbose

# Fix common issues
# - Missing required fields
# - Invalid schema references
# - Incorrect data types
```

### Build Failures

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 16+

# Verify OpenAPI spec is valid JSON/YAML
npx @apidevtools/swagger-cli validate openapi.yaml
```

### Performance Issues

```bash
# Use static generation instead of runtime parsing
redoc-cli bundle openapi.yaml -o docs/index.html

# Optimize images and assets
# - Minimize OpenAPI spec size
# - Remove unused schemas
# - Use CDN for assets
```

---

## Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [Redoc Documentation](https://redocly.com/redoc/)
- [Docusaurus Documentation](https://docusaurus.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Spectral Linter](https://stoplight.io/open-source/spectral)
- [Postman Learning Center](https://learning.postman.com/)

---

## Support

For questions or issues with API documentation tools:
- Create an issue in the repository
- Contact the development team
- Check the tool's official documentation
