$VPS_IP = "147.93.3.29"
$VPS_USER = "root"
$APP_NAME = "tdpadmin"
$REMOTE_PATH = "/opt/tdp/apps/$APP_NAME"
$IDENTITY_FILE = "$HOME\.ssh\id_rsa"
$SSH_ID_OPT = if (Test-Path $IDENTITY_FILE) { "-i `"$IDENTITY_FILE`"" } else { "" }

Write-Host "INICIANDO DEPLOY TDP: $APP_NAME" -ForegroundColor Cyan

Write-Host "--- Verificando build local ---" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "--- Empaquetando proyecto ---" -ForegroundColor Cyan
if (Test-Path "tdpadmin-deploy.tar.gz") { Remove-Item "tdpadmin-deploy.tar.gz" -Force }

tar `
  --exclude=".git" `
  --exclude="node_modules" `
  --exclude="dist" `
  --exclude="tdpadmin-deploy.tar.gz" `
  -czf "tdpadmin-deploy.tar.gz" .

Write-Host "--- Subiendo paquete al VPS ---" -ForegroundColor Cyan
scp $SSH_ID_OPT .\tdpadmin-deploy.tar.gz "${VPS_USER}@${VPS_IP}:/tmp/tdpadmin-deploy.tar.gz"

$bashCmd = @"
set -e
mkdir -p $REMOTE_PATH
cd $REMOTE_PATH

if [ -f .env ]; then
  cp .env /tmp/${APP_NAME}.env.bak
fi

rm -rf ./*
tar -xzf /tmp/tdpadmin-deploy.tar.gz -C $REMOTE_PATH

if [ -f /tmp/${APP_NAME}.env.bak ]; then
  cp /tmp/${APP_NAME}.env.bak $REMOTE_PATH/.env
else
  echo "ERROR: No existe .env previo en servidor. Crea $REMOTE_PATH/.env antes de desplegar."
  exit 1
fi

docker compose build
docker compose up -d

rm /tmp/tdpadmin-deploy.tar.gz

docker ps --filter "name=tdpadmin"
"@

$bashCmd = $bashCmd -replace "`r", ""

Write-Host "--- Ejecutando deploy remoto ---" -ForegroundColor Cyan
ssh $SSH_ID_OPT "${VPS_USER}@${VPS_IP}" "bash -c `"$bashCmd`""

Write-Host "DEPLOY COMPLETADO" -ForegroundColor Green
