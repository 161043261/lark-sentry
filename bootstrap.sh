mkdir lark-sentry

cd lark-sentry

pnpm init

touch pnpm-workspace.yaml

touch .npmrc

echo "packages:
  - 'packages/*'" >./pnpm-workspace.yaml

echo "link-workspace-packages=true" >./.npmrc

echo "{
  \"name\": \"lark-sentry\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

mkdir -p packages/{constants,core,performance,reporter,screen-record,types,utils}

cd packages/constants
pnpm init

echo "{
  \"name\": \"@lark-sentry/constants\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk constants\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"constants\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../core
pnpm init

echo "{
  \"name\": \"@lark-sentry/core\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk core\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"core\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../performance
pnpm init

echo "{
  \"name\": \"@lark-sentry/performance\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk performance\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"performance\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../types
pnpm init

echo "{
  \"name\": \"@lark-sentry/types\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk types\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"types\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../utils
pnpm init

echo "{
  \"name\": \"@lark-sentry/utils\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk utils\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"utils\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../screen-record
pnpm init

echo "{
  \"name\": \"@lark-sentry/screen-record\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk screen-record\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"screen-record\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../reporter
pnpm init

echo "{
  \"name\": \"@lark-sentry/reporter\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk reporter\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"reporter\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../demo
pnpm init

echo "{
  \"name\": \"@lark-sentry/demo\",
  \"version\": \"1.0.0\",
  \"description\": \"Sentry sdk demo\",
  \"private\": true,
  \"scripts\": {
  },
  \"keywords\": [\"sentry\", \"sdk\", \"demo\"],
  \"author\": \"github.com/161043261\",
  \"license\": \"MIT\",
  \"type\": \"module\"
}" > ./package.json

cd ../..

tsc --init
touch ./shims.d.ts

cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "module": "nodenext",
    "target": "esnext",
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strict": true,
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "nodenext",
    "lib": ["ESNext", "DOM"],
    "esModuleInterop": true,
    // "importHelpers": true,
    "paths": {
      "@lark-sentry/*": ["./packages/*/src"]
    }
  },
  "include": ["shims.d.ts", "packages", "tests"]
}
EOF

cd ./packages/core

echo pnpm add @lark-sentry/constants --filter @lark-sentry/core
pnpm add @lark-sentry/constants --filter @lark-sentry/core

cd ../..
