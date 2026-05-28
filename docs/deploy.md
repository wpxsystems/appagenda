# Deploy — AppAgenda

> Guia completo de deploy: API + web admin na VPS WPX, mobile via EAS Build para App Store + Play Store.
> Baseado no guia [novo-projeto-vps.md](https://wpxsystems.com.br) padrão WPX, adaptado para este projeto.

---

## Índice

1. Pré-requisitos
2. Setup inicial na VPS (primeira vez)
3. Configurar git-deploy + CI/CD
4. Criar `.env` na VPS
5. Criar banco + extensões PostGIS
6. Criar `compose.yml`
7. Subir o projeto (primeira vez)
8. Configurar DNS
9. Verificar HTTPS
10. CI/CD via GitHub Actions
11. Adicionar ao backup automático
12. Deploy do mobile via EAS
13. Submeter para App Store + Play Console
14. Releases pós-lançamento

---

## 1. PRÉ-REQUISITOS

- Acesso SSH à VPS como `wsilva`
- Domínio `wpxsystems.com.br` controlado no Registro.br
- Conta Apple Developer ativa ($99/ano)
- Conta Google Play Developer ativa (US$ 25 único)
- Conta Expo / EAS configurada (org `wpxsystems`)
- 1Password aberto para salvar segredos gerados

---

## 2. SETUP INICIAL NA VPS

```bash
ssh wsilva@72.60.50.139

# Criar pasta do projeto (já feito — está em /opt/systems/apps/appagenda)
cd /opt/systems/apps/appagenda

# Confirmar que o clone está OK
ls -la                # deve mostrar .git, package.json, apps/, packages/
git status            # deve dizer "On branch main, nothing to commit"
git pull origin main  # garante última versão
```

---

## 3. CONFIGURAR USUÁRIO git-deploy (CI/CD)

```bash
# 1. Gerar chave SSH dedicada para o projeto
sudo -u git-deploy ssh-keygen -t ed25519 \
  -C "github-actions-appagenda" \
  -f /home/git-deploy/.ssh/appagenda_deploy -N ""

# 2. Ver a chave PÚBLICA (vai no GitHub como Deploy Key)
sudo cat /home/git-deploy/.ssh/appagenda_deploy.pub

# 3. Ver a chave PRIVADA (vai no GitHub Secret VPS_SSH_KEY)
sudo cat /home/git-deploy/.ssh/appagenda_deploy
```

Adicionar host no config do git-deploy:

```bash
sudo nano /home/git-deploy/.ssh/config
```

Adicionar no final:

```
Host github-appagenda
  HostName github.com
  User git
  IdentityFile ~/.ssh/appagenda_deploy
```

Testar:

```bash
sudo -u git-deploy ssh -T git@github-appagenda
# Esperado: Hi wpxsystems/appagenda! You've successfully authenticated...
```

Adicionar chave pública como **Deploy Key** no GitHub:
- `https://github.com/wpxsystems/appagenda/settings/keys`
- Title: `git-deploy-vps`
- **Não** marcar "Allow write access"

Autorizar a chave para acesso SSH local (padrão WPX para CI/CD):

```bash
# Adicionar pubkey ao authorized_keys do git-deploy
sudo bash -c 'cat /home/git-deploy/.ssh/appagenda_deploy.pub >> /home/git-deploy/.ssh/authorized_keys'
sudo chmod 600 /home/git-deploy/.ssh/authorized_keys
sudo chown git-deploy:git-deploy /home/git-deploy/.ssh/authorized_keys

# Desbloquear conta (se necessário)
sudo usermod -p '*' git-deploy
sudo passwd -S git-deploy
```

Dar permissão ao git-deploy na pasta:

```bash
sudo chown -R git-deploy:wpxteam /opt/systems/apps/appagenda
sudo chmod -R g+rw /opt/systems/apps/appagenda
sudo -u git-deploy git config --global --add safe.directory /opt/systems/apps/appagenda
sudo -u git-deploy git -C /opt/systems/apps/appagenda \
  remote set-url origin git@github-appagenda:wpxsystems/appagenda.git
```

---

## 4. CRIAR O .env

```bash
nano /opt/systems/apps/appagenda/apps/api/.env
chmod 600 /opt/systems/apps/appagenda/apps/api/.env
```

Usar o modelo da [credenciais.md → seção 4](credenciais.md#4-variáveis-de-ambiente--api). Gerar segredos:

```bash
# JWT secrets
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET

# Senhas do banco
openssl rand -base64 32   # → DB_PASSWORD (appagenda_app)
openssl rand -base64 32   # → DB_AUTH_PASSWORD (appagenda_auth)
```

> **Salvar tudo no 1Password antes de fechar o terminal!**

Confirmar que o `.env` está no `.gitignore`:

```bash
grep -F ".env" /opt/systems/apps/appagenda/.gitignore || echo ".env" >> /opt/systems/apps/appagenda/.gitignore
```

---

## 5. BANCO DE DADOS

### 5.1 Criar banco + extensões

```bash
# Criar
docker exec -it postgres psql -U wpxadmin -d postgres -c 'CREATE DATABASE appagenda;'

# Extensões (PostGIS é crítico — sem isso a app não sobe)
docker exec -it postgres psql -U wpxadmin -d appagenda -c '
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE EXTENSION IF NOT EXISTS "pg_trgm";
  CREATE EXTENSION IF NOT EXISTS "postgis";
'

# Confirmar
docker exec -it postgres psql -U wpxadmin -d appagenda -c '\dx'
# Deve listar: pgcrypto, pg_trgm, postgis (com versão)
```

### 5.2 Criar usuários dedicados

```bash
# Usuário do app — pega senha do .env
DB_PASS=$(grep ^DB_PASSWORD= /opt/systems/apps/appagenda/apps/api/.env | cut -d= -f2-)
DB_AUTH_PASS=$(grep ^DB_AUTH_PASSWORD= /opt/systems/apps/appagenda/apps/api/.env | cut -d= -f2-)

docker exec -i postgres psql -U wpxadmin -d postgres <<EOF
CREATE USER appagenda_app  WITH PASSWORD '$DB_PASS';
CREATE USER appagenda_auth WITH PASSWORD '$DB_AUTH_PASS' BYPASSRLS;
GRANT CONNECT ON DATABASE appagenda TO appagenda_app, appagenda_auth;
EOF

docker exec -i postgres psql -U wpxadmin -d appagenda <<'EOF'
GRANT USAGE, CREATE ON SCHEMA public TO appagenda_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO appagenda_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO appagenda_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO appagenda_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO appagenda_app;
EOF

# Validar
docker exec -it postgres psql -U wpxadmin -d postgres -c '\du appagenda_app'
docker exec -it postgres psql -U wpxadmin -d postgres -c '\du appagenda_auth'
```

### 5.3 Rodar migrations + seeds

Esperar até subir o container da API (passo 7). Comando final:

```bash
docker exec -it appagenda-api npm run migrate
docker exec -it appagenda-api npm run seed   # cidades + venues iniciais Joinville
```

---

## 6. CRIAR O compose.yml

```bash
nano /opt/systems/apps/appagenda/compose.yml
chmod 640 /opt/systems/apps/appagenda/compose.yml
```

```yaml
services:
  # ── API ──────────────────────────────────────────────────────────
  appagenda-api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    image: appagenda-api:latest
    container_name: appagenda-api
    restart: unless-stopped
    env_file: apps/api/.env
    networks:
      - wpxnet
    # Hardening
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    tmpfs:
      - /tmp:size=64M,mode=1777
    mem_limit: 768m
    pids_limit: 300
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=wpxnet"
      - "traefik.http.routers.appagenda-api.rule=Host(`api.appagenda.wpxsystems.com.br`)"
      - "traefik.http.routers.appagenda-api.entrypoints=websecure"
      - "traefik.http.routers.appagenda-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.appagenda-api.loadbalancer.server.port=3000"

  # ── Web admin (Vite build → servido por nginx) ──────────────────
  appagenda-web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    image: appagenda-web:latest
    container_name: appagenda-web
    restart: unless-stopped
    networks:
      - wpxnet
    mem_limit: 128m
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=wpxnet"
      - "traefik.http.routers.appagenda-web.rule=Host(`appagenda.wpxsystems.com.br`)"
      - "traefik.http.routers.appagenda-web.entrypoints=websecure"
      - "traefik.http.routers.appagenda-web.tls.certresolver=letsencrypt"
      - "traefik.http.services.appagenda-web.loadbalancer.server.port=80"

networks:
  wpxnet:
    external: true
```

---

## 7. SUBIR O PROJETO (primeira vez)

```bash
cd /opt/systems/apps/appagenda

# Build inicial (pode demorar 3-5 min — pnpm install + build)
docker compose build

# Subir
docker compose up -d

# Acompanhar logs
docker compose logs -f appagenda-api
# (Ctrl+C para sair dos logs — não para o container)

# Rodar migrations + seeds
docker exec -it appagenda-api npm run migrate
docker exec -it appagenda-api npm run seed
```

Confirmar saúde:

```bash
docker ps | grep appagenda                  # ambos containers UP
curl -I http://localhost:3000/health        # 200 OK (interno)
docker exec appagenda-api ls /app/dist      # arquivos do build presentes
```

---

## 8. CONFIGURAR DNS

No Registro.br (painel `wpxsystems.com.br`):

```
Tipo   Nome              Valor
A      api.appagenda     72.60.50.139
A      appagenda         72.60.50.139
CNAME  cdn.appagenda     <bucket>.<account-id>.r2.dev    (após criar bucket R2)
```

Aguardar propagação (geralmente 5-30 min):

```bash
nslookup api.appagenda.wpxsystems.com.br
nslookup appagenda.wpxsystems.com.br
```

---

## 9. VERIFICAR HTTPS

```bash
# Verificar certificado da API
curl -I https://api.appagenda.wpxsystems.com.br/health

# Verificar certificado da web
curl -I https://appagenda.wpxsystems.com.br

# Se der erro de certificado self-signed:
ls -la /opt/systems/volumes/traefik/acme.json
# Deve ser 600. Se não for:
sudo chmod 600 /opt/systems/volumes/traefik/acme.json
docker restart traefik

# Ver logs do Traefik
docker logs --tail=30 traefik
```

---

## 10. CI/CD VIA GITHUB ACTIONS

Criar `.github/workflows/deploy.yml` **no repositório local** (commitar e fazer push):

```yaml
name: Deploy AppAgenda

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: Production

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            cd /opt/systems/apps/appagenda
            git pull origin main
            docker compose build
            docker compose up -d --force-recreate
            docker exec appagenda-api npm run migrate
            docker image prune -f
```

Configurar Secrets em `https://github.com/wpxsystems/appagenda/settings/environments`:

| Secret         | Valor                                                       |
| -------------- | ----------------------------------------------------------- |
| `VPS_HOST`     | `72.60.50.139`                                              |
| `VPS_USER`     | `git-deploy`                                                |
| `VPS_PORT`     | `22`                                                        |
| `VPS_SSH_KEY`  | conteúdo de `/home/git-deploy/.ssh/appagenda_deploy`       |

Para ver a chave privada:

```bash
sudo cat /home/git-deploy/.ssh/appagenda_deploy
```

Copiar **TODO** o conteúdo incluindo `-----BEGIN OPENSSH PRIVATE KEY-----` e `-----END OPENSSH PRIVATE KEY-----`.

---

## 11. BACKUP AUTOMÁTICO

Editar `/opt/systems/backups.sh`:

```bash
sudo nano /opt/systems/backups.sh
```

Adicionar:

```bash
# AppAgenda
docker exec postgres pg_dump -U wpxadmin appagenda | gzip > $BACKUP_DIR/pg_appagenda_$DATE.sql.gz
```

Validar:

```bash
sudo /opt/systems/backups.sh
ls -lht /opt/systems/volumes/backups | head -10
# Deve aparecer pg_appagenda_DATA.sql.gz
```

---

## 12. DEPLOY DO MOBILE VIA EAS

### 12.1 Setup inicial (uma vez)

```bash
# Local (não na VPS — build pesado)
cd apps/mobile

# Login no Expo
eas login

# Vincular projeto
eas init

# Configurar build profiles
nano eas.json
```

`eas.json` — perfis recomendados:

```json
{
  "cli": { "version": ">= 7.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "http://192.168.0.x:3000" }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "env": { "EXPO_PUBLIC_API_URL": "https://api.appagenda.wpxsystems.com.br" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_URL": "https://api.appagenda.wpxsystems.com.br" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "<seu-apple-id>",
        "ascAppId": "<App Store Connect App ID>",
        "appleTeamId": "<Team ID>"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json"
      }
    }
  }
}
```

### 12.2 Configurar `app.config.ts` (ou `app.json`)

```ts
export default {
  expo: {
    name: 'AppAgenda',
    slug: 'appagenda',
    version: '1.0.0',
    owner: 'wpxsystems',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: { image: './assets/splash.png', resizeMode: 'cover', backgroundColor: '#ffffff' },
    ios: {
      bundleIdentifier: 'br.com.wpxsystems.appagenda',
      buildNumber: '1',
      supportsTablet: false,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Usamos sua localização apenas para mostrar jogos próximos. Você pode revogar a qualquer momento.',
        NSCameraUsageDescription: 'Para adicionar uma foto de perfil.',
        NSPhotoLibraryUsageDescription: 'Para escolher uma foto da galeria como avatar.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'br.com.wpxsystems.appagenda',
      versionCode: 1,
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#ffffff' },
      permissions: ['ACCESS_FINE_LOCATION', 'CAMERA', 'READ_MEDIA_IMAGES', 'POST_NOTIFICATIONS'],
    },
    extra: { eas: { projectId: '<UUID gerado pelo eas init>' } },
    plugins: [
      'expo-secure-store',
      ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Usamos sua localização apenas para mostrar jogos próximos.' }],
    ],
  },
};
```

### 12.3 Builds

```bash
# Build de teste interno (TestFlight + Play Internal)
eas build --profile preview --platform all

# Build de produção
eas build --profile production --platform all
```

EAS responde com URLs dos builds — quando finalizam (15-30 min), baixar os artifacts ou submeter direto.

---

## 13. SUBMETER PARA APP STORE + PLAY CONSOLE

### 13.1 iOS — TestFlight

```bash
# Submeter automaticamente após o build
eas submit --profile production --platform ios --latest

# Ou submeter um build específico
eas submit --profile production --platform ios --id <build-id>
```

Processo:
1. EAS envia o `.ipa` para App Store Connect
2. Apple faz processamento (10-60 min)
3. Build aparece em TestFlight → testar internamente
4. Quando estiver OK: criar versão em "App Store" no ASC
5. Preencher metadata (descrição, screenshots, **App Privacy Labels**)
6. Submeter para review (geralmente 1-3 dias)

**Documentos a preparar antes:**
- 4-8 screenshots por tamanho de tela exigido (6.7", 6.5", 5.5", iPad se aplicável)
- Ícone 1024x1024 sem alpha
- Política de Privacidade pública: `https://appagenda.wpxsystems.com.br/privacidade`
- Termos de Uso: `https://appagenda.wpxsystems.com.br/termos`
- Descrição em pt-BR e en-US (mínimo)
- Categoria: Sports
- Idade: 12+ (recomendado para apps sociais com chat)

### 13.2 Android — Play Console

```bash
# Submeter automaticamente
eas submit --profile production --platform android --latest
```

Para a primeira submissão, criar service account no Google Cloud:
1. Console GCP → IAM & Admin → Service Accounts → criar
2. Conceder role "Service Account User"
3. Gerar chave JSON e salvar como `apps/mobile/google-service-account.json`
4. No Play Console: Settings → API access → vincular o service account com permissão "Release manager"

Processo:
1. EAS envia `.aab` para Play Console
2. Aparece em Internal testing (imediato)
3. Promover para Closed testing → Open testing → Production
4. Preencher **Data Safety form** (equivalente das App Privacy Labels)
5. Review da primeira versão: 3-7 dias

**Documentos a preparar:**
- 2-8 screenshots de celular
- Feature graphic 1024x500
- Ícone 512x512
- Política de Privacidade pública
- Categoria: Sports
- Public verification (Play Integrity)

---

## 14. RELEASES PÓS-LANÇAMENTO

### 14.1 Backend (commit + push em `main`)

CI/CD automático via GitHub Actions (passo 10) faz:
1. SSH na VPS
2. `git pull`
3. `docker compose build && up -d`
4. Roda migrations

### 14.2 Mobile (versão nova)

```bash
# 1. Bumpar versão no app.config.ts (1.0.0 → 1.0.1)
#    Para iOS: incrementar buildNumber
#    Para Android: incrementar versionCode

# 2. Build
eas build --profile production --platform all --auto-submit

# 3. iOS: aparece em TestFlight automaticamente; promover manualmente para App Store quando OK
# 4. Android: aparece em Internal testing; promover para Production
```

### 14.3 Forçar update do app antigo

Se uma versão tem bug grave, editar `/api/config`:

```js
// api/src/controllers/config.controller.js
exports.config = (req, res) => res.json({
  success: true,
  data: {
    min_app_version: '1.2.0',         // recomendado atualizar
    force_update_below: '1.0.0',      // bloqueia abaixo desta versão
    maintenance: false,
    message: 'Por favor, atualize o app para continuar.',
  },
});
```

O app mobile checa essa rota no boot e bloqueia uso se a versão for menor que `force_update_below`.

---

## 15. PROBLEMAS COMUNS

| Sintoma                                | Solução                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| Bad Gateway no Traefik                 | Verificar `traefik.docker.network=wpxnet` nas labels         |
| SSL self-signed                        | `chmod 600 /opt/systems/volumes/traefik/acme.json && docker restart traefik` |
| `permission denied (publickey)` no CI  | Confirmar chave em authorized_keys do git-deploy             |
| Postgres "permission denied for table" | Rodar GRANT DEFAULT PRIVILEGES da seção 5.2 de novo         |
| `safe.directory` no git pull           | `git config --global --add safe.directory /opt/systems/apps/appagenda` |
| PostGIS `function st_dwithin does not exist` | Faltou `CREATE EXTENSION postgis;` no banco            |
| EAS Build falha por memória            | EAS Cloud é Mac M1; localmente usar `--local`                |
| App rejeitado por permissão sem uso    | Remover permissões não usadas do `Info.plist`/`app.json`    |
| Apple rejeita por falta de account deletion | Implementar `POST /me/delete` + tela de exclusão (seção 5.1 LGPD) |

---

## 16. COMANDOS ÚTEIS DO DIA-A-DIA

```bash
# Status dos containers do projeto
docker ps --filter "name=appagenda"

# Logs em tempo real
docker logs -f appagenda-api
docker logs -f appagenda-web

# Restart só a API
docker compose restart appagenda-api

# Recriar tudo do zero (após troca de imagem base)
docker compose up -d --force-recreate

# Entrar no container
docker exec -it appagenda-api sh

# Acessar o banco
docker exec -it postgres psql -U wpxadmin -d appagenda

# Ver consumo de recursos
docker stats --no-stream | grep appagenda

# Restaurar último backup do banco
LATEST=$(ls -t /opt/systems/volumes/backups/pg_appagenda_*.sql.gz | head -1)
gunzip -c $LATEST | docker exec -i postgres psql -U wpxadmin -d appagenda
```
