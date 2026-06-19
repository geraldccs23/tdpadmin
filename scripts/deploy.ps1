$VPS_IP = "161.97.145.16"
$VPS_USER = "root"
$REMOTE_PATH = "/var/www/rg7-admin"
$IDENTITY_FILE = "$HOME\.ssh\id_rsa"
$SSH_ID_OPT = if (Test-Path $IDENTITY_FILE) { "-i ""$IDENTITY_FILE""" } else { "" }

Write-Host "INICIANDO DESPLIEGUE..." -ForegroundColor Cyan

# 1. Build Local
Write-Host "--- Compilando Frontend (pnpm) ---" -ForegroundColor Cyan
pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 2. Bundling
tar -czf "frontend-bundle.tar.gz" -C "dist" .

$staging = New-Item -ItemType Directory -Path "$env:TEMP\rg7-staging" -Force
Copy-Item -Path "server.cjs" -Destination $staging
Copy-Item -Path "package.json.backend" -Destination "$staging\package.json"
if (Test-Path ".env") { Copy-Item -Path ".env" -Destination "$staging\.env" }
tar -czf "backend-bundle.tar.gz" -C $staging .
Remove-Item -Path $staging -Recurse -Force

# 3. Upload
Write-Host "--- Subiendo archivos ---" -ForegroundColor Cyan
scp $SSH_ID_OPT .\frontend-bundle.tar.gz .\backend-bundle.tar.gz .\deployment\rg7-admin.yaml .\deployment\rg7-admin-nginx.conf "${VPS_USER}@${VPS_IP}:/tmp/"

# 4. Remote commands
$bashCmd = @"
set -ex
mkdir -p ${REMOTE_PATH}/dist
mkdir -p ${REMOTE_PATH}/backend
rm -rf ${REMOTE_PATH}/dist/*
tar -xzf /tmp/frontend-bundle.tar.gz -C ${REMOTE_PATH}/dist
find ${REMOTE_PATH}/backend -maxdepth 1 -not -name "node_modules" -not -name "backend" -not -name "server.cjs" -exec rm -rf {} + || true
tar -xzf /tmp/backend-bundle.tar.gz -C ${REMOTE_PATH}/backend
cp /tmp/rg7-admin.yaml /root/rg7-admin.yaml
cp /tmp/rg7-admin-nginx.conf /root/rg7-admin-nginx.conf
cd /root
docker stack deploy -c rg7-admin.yaml rg7-admin --with-registry-auth
rm /tmp/frontend-bundle.tar.gz /tmp/backend-bundle.tar.gz /tmp/rg7-admin.yaml /tmp/rg7-admin-nginx.conf
"@

$bashCmd = $bashCmd -replace "`r", ""
ssh $SSH_ID_OPT "${VPS_USER}@${VPS_IP}" "bash -c `"$bashCmd`""

Write-Host "PROCESO COMPLETADO" -ForegroundColor Green
Write-Host "URL: https://admin.rg7.com.ve"
Write-Host "Scripts SQL en /tmp del servidor"
