FROM node:18-alpine

WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar código fonte
COPY . .

# Build do TypeScript
RUN npm run build

# Criar diretório de uploads
RUN mkdir -p uploads/media

# Expor porta
EXPOSE 3001

# Comando para iniciar
CMD ["npm", "start"]


