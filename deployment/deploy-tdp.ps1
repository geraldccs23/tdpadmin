$VPS_IP = "147.93.3.29"
$VPS_USER = "root"
$APP_NAME = "restaurantdp"
$REMOTE_PATH = "/opt/tdp/apps/$APP_NAME"
$IDENTITY_FILE = "$HOME\.ssh\id_rsa"
$SSH_ID_OPT = if (Test-Path $IDENTITY_FILE) { "-i `"$IDENTITY_FILE`"" } else { "" }

Write-Host "INICIANDO DEPLOY TDP: $APP_NAME" -ForegroundColor Cyan

Write-Host "--- Verificando build local ---" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "--- Empaquetando proyecto ---" -ForegroundColor Cyan
if (Test-Path "restaurantdp-deploy.tar.gz") { Remove-Item "restaurantdp-deploy.tar.gz" -Force }

tar `
  --exclude=".git" `
  --exclude="node_modules" `
  --exclude="dist" `
  --exclude="restaurantdp-deploy.tar.gz" `
  -czf "restaurantdp-deploy.tar.gz" .

Write-Host "--- Subiendo paquete al VPS ---" -ForegroundColor Cyan
scp $SSH_ID_OPT .\restaurantdp-deploy.tar.gz "${VPS_USER}@${VPS_IP}:/tmp/restaurantdp-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$bashCmd = @"
set -e
mkdir -p $REMOTE_PATH
cd $REMOTE_PATH

if [ -f .env ]; then
  cp .env /tmp/restaurantdp.env.bak
fi

rm -rf ./*
tar -xzf /tmp/restaurantdp-deploy.tar.gz -C $REMOTE_PATH

if [ -f /tmp/restaurantdp.env.bak ]; then
  cp /tmp/restaurantdp.env.bak $REMOTE_PATH/.env
else
  echo "ERROR: No existe .env previo en servidor. Crea $REMOTE_PATH/.env antes de desplegar."
  exit 1
fi

docker compose build
docker compose up -d

rm /tmp/restaurantdp-deploy.tar.gz

docker ps --filter "name=restaurantdp"
"@

$bashCmd = $bashCmd -replace "`r", ""

Write-Host "--- Ejecutando deploy remoto ---" -ForegroundColor Cyan
ssh $SSH_ID_OPT "${VPS_USER}@${VPS_IP}" "bash -c `"$bashCmd`""
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "DEPLOY COMPLETADO" -ForegroundColor Green
