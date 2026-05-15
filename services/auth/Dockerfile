# 1. Grab a "mini-laptop" that already has Node.js v20 installed
FROM node:20-alpine

# 2. Create a folder inside the mini-laptop called /app
WORKDIR /app

# 3. Copy your package.json from your real computer into the mini-laptop
COPY package*.json ./

# 4. Run npm install inside the mini-laptop
RUN npm install

# 5. Copy the rest of your code over
COPY . .

# 6. Expose port 8001 (so your real computer can talk to it)
EXPOSE 8001

# 7. Tell the mini-laptop what command to run to start the app
CMD ["npm", "start"]