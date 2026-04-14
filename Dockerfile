FROM nginx:alpine

# SPA 빌드 결과물 복사
COPY dist/ /usr/share/nginx/html/

# nginx 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
