# =====================================================================
#  Las pantallas.
#
#  OJO con la URL: Vite reemplaza VITE_SUPABASE_URL en tiempo de
#  COMPILACIÓN, no de ejecución. Queda escrita adentro del JavaScript.
#
#  Si se construye con "localhost", cada PC de la clínica va a intentar
#  conectarse a sí misma en vez de al servidor — y eso funciona perfecto
#  en la máquina donde se compiló, así que no se nota hasta el día de la
#  instalación, cuando falla en todas las demás.
#
#  Por eso la dirección entra como argumento:
#     docker compose build --build-arg VITE_SUPABASE_URL=http://servidor-cml:8000
#  o, más simple, desde el .env del compose (ya está conectado).
# =====================================================================
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm ci
COPY . .

# Si no llegó la URL, mejor romper acá que publicar algo que apunta a
# ninguna parte y descubrirlo con la clínica esperando.
RUN test -n "$VITE_SUPABASE_URL" || (echo "FALTA VITE_SUPABASE_URL: la app apuntaría a la nada" && exit 1)
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
