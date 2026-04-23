# Finanças Familiar — Guia de Instalação

Este guia explica como colocar a aplicação a funcionar em menos de 15 minutos.
Não precisa de saber programar — basta seguir os passos um a um.

---

## O que vai precisar

- Uma conta Google (Gmail)
- Uma conta GitHub (gratuita) — [criar em github.com](https://github.com)
- Um computador com browser (Chrome ou Edge recomendados para o primeiro setup)

---

## Passo 1 — Criar o projeto no Google Cloud

Este passo regista a vossa aplicação no sistema do Google, para que possa aceder ao Google Sheets com a vossa permissão.

1. Abra [console.cloud.google.com](https://console.cloud.google.com) e entre com a vossa conta Google.

2. No topo da página, clique em **"Select a project"** → **"New Project"**.
   - Dê um nome ao projeto: por exemplo `financas-familiar`
   - Clique em **"Create"**

3. No menu lateral esquerdo, vá a **"APIs & Services"** → **"Library"**.

4. Procure por **"Google Sheets API"**, clique nela e clique em **"Enable"**.

5. Volte a **"APIs & Services"** → **"OAuth consent screen"**.
   - Escolha **"External"** e clique em **"Create"**
   - Preencha o campo **"App name"** com `Finanças Familiar`
   - Preencha o **"User support email"** com o vosso email
   - Em baixo em **"Developer contact information"**, volte a colocar o email
   - Clique em **"Save and Continue"** até ao fim (não precisa de preencher mais nada)
   - Na última página, clique em **"Back to Dashboard"**

6. Ainda em **"APIs & Services"**, vá a **"Credentials"**.
   - Clique em **"+ Create Credentials"** → **"OAuth client ID"**
   - Em **"Application type"**, escolha **"Web application"**
   - Em **"Name"**, escreva `Finanças Familiar`
   - Em **"Authorized JavaScript origins"**, clique em **"+ Add URI"** e coloque:
     ```
     https://O-VOSSO-USERNAME.github.io
     ```
     (substitua `O-VOSSO-USERNAME` pelo vosso nome de utilizador do GitHub)
   - Clique em **"Create"**

7. Aparece uma janela com o **Client ID**. Copie esse valor — parece-se com:
   ```
   123456789-abcdefghijklmnop.apps.googleusercontent.com
   ```
   Vai precisar dele no próximo passo.

---

## Passo 2 — Colocar o Client ID no código

1. Abra o ficheiro `sheets.js` num editor de texto (pode usar o Bloco de Notas).

2. Na linha 14, encontre esta linha:
   ```javascript
   const GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com';
   ```

3. Substitua `SEU_CLIENT_ID_AQUI.apps.googleusercontent.com` pelo Client ID que copiou.
   O resultado deve ficar parecido com:
   ```javascript
   const GOOGLE_CLIENT_ID = '123456789-abcdefghijklmnop.apps.googleusercontent.com';
   ```

4. Guarde o ficheiro.

---

## Passo 3 — Publicar no GitHub Pages

1. Entre na vossa conta em [github.com](https://github.com).

2. Clique em **"New repository"** (botão verde ou no canto superior direito).
   - **Repository name**: `financas-familiar` (exatamente assim, em minúsculas)
   - Certifique-se que está marcado como **"Public"**
   - Clique em **"Create repository"**

3. Na página do repositório que acabou de criar, clique em **"uploading an existing file"**.

4. Arraste os 4 ficheiros da aplicação para a área de upload:
   - `index.html`
   - `style.css`
   - `app.js`
   - `sheets.js`

5. Em baixo, clique em **"Commit changes"**.

6. Vá a **"Settings"** (no menu do repositório) → **"Pages"** (no menu lateral).

7. Em **"Source"**, escolha **"Deploy from a branch"**.
   Em **"Branch"**, escolha **"main"** e clique em **"Save"**.

8. Aguarde 1-2 minutos. A página fica disponível em:
   ```
   https://O-VOSSO-USERNAME.github.io/financas-familiar
   ```

---

## Passo 4 — Primeiro uso

1. Abra o link acima no browser.

2. Clique em **"Entrar com Google"** — aparece um popup do Google a pedir autorização.
   Escolha a conta Google que quer usar e clique em **"Allow"**.

3. Na primeira vez, aparece o ecrã de configuração:
   - Coloque o vosso nome e o nome do/a parceiro/a
   - Clique em **"Criar folha e começar"**

4. A app cria automaticamente uma folha Google Sheets na vossa conta e abre o dashboard.

5. Para partilhar com o/a parceiro/a, basta enviar o link:
   ```
   https://O-VOSSO-USERNAME.github.io/financas-familiar
   ```
   Ele/ela faz login com a própria conta Google e, na configuração, escolhe **"usar folha existente"**
   colando o ID da folha que encontra nas Definições da app.

---

## Como usar no telemóvel

A app funciona em qualquer browser móvel. Para ter um acesso mais rápido:

**iPhone (Safari):** Abra o link → toque no ícone de partilha → "Adicionar ao ecrã de início"

**Android (Chrome):** Abra o link → toque nos três pontos → "Adicionar ao ecrã inicial"

A app fica guardada como um ícone no vosso telemóvel, exatamente como uma app normal.

---

## Como importar extratos do banco

Todos os bancos portugueses permitem exportar os movimentos. Aqui ficam as instruções para os mais comuns:

**Millennium BCP:** Conta corrente → Movimentos → Exportar → CSV

**CGD (Caixa):** Contas → Movimentos → Exportar → Excel ou CSV

**BPI:** Conta à ordem → Extracto → Exportar movimentos → CSV

**Santander:** Contas → Extracto → Exportar → CSV

**Novobanco:** Conta → Movimentos → Exportar → CSV

Depois de descarregar o ficheiro, na app vá a **Transações** → **Importar CSV** e arraste o ficheiro.
A app tenta categorizar automaticamente cada movimento.

---

## Perguntas frequentes

**Os dados são privados?**
Sim. Os dados ficam guardados no vosso Google Sheets pessoal, que só vocês têm acesso.
A aplicação não tem servidor próprio — é apenas código estático que corre no vosso browser.

**O que acontece se o token do Google expirar?**
O token do Google dura enquanto a sessão do browser está ativa. Se fechar o browser e voltar,
basta clicar em "Entrar com Google" novamente — os dados estão todos guardados no Sheets.

**Posso usar em vários dispositivos ao mesmo tempo?**
Sim. Tanto você como o/a parceiro/a podem ter a app aberta em simultâneo.
Os dados são sincronizados com o Google Sheets, por isso estão sempre atualizados.

**E se quiser fazer uma cópia de segurança?**
Em Definições → Exportar CSV, pode descarregar todas as transações do ano num ficheiro.
O Google Sheets também guarda o histórico de versões automaticamente.

---

## Ajuda

Se tiver algum problema, abra uma issue no repositório GitHub ou consulte:
- [Documentação Google Sheets API](https://developers.google.com/sheets/api)
- [Documentação GitHub Pages](https://docs.github.com/pages)
