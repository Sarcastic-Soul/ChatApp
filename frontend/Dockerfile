# Builds the app and serves it with nginx, which also forwards /api to the
# backend the way vercel.json does in production
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@12.4.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The browser opens the socket straight to the backend, so this is a URL
# the browser can reach, not a Docker network name
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
