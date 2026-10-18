# E-SHTYLE — yahan se shuru karo

Poora project isi folder mein hai: website (frontend), server (`backend/src/server.js`),
59 products ki photos aur data (`backend/uploads/seed`, `backend/seed/catalog.json`),
admin panel, return policy, Razorpay, Shiprocket, email — sab.

Sirf **Node.js 22** chahiye (https://nodejs.org).

## A) Apne computer pe chalana (testing)

```
cd eshtyle
npm i
npm run dev
```

- Store: http://localhost:5173
- Admin: http://localhost:5173/admin  → **admin@eshtyle.test / Eshtyle@2026**
- Test customer: **customer@eshtyle.test / Eshtyle@2026**
  (ye test logins sirf apne computer pe chalte hain, live site pe band rehte hain)
- OTP / emails terminal mein dikhte hain (`[api]` lines)
- Band karna: Ctrl+C. Agli baar sirf `npm run dev`.

Database apne aap chalu hota hai (MongoDB alag se install nahi karna).
Agar wahan error aaye: MongoDB Atlas ka free link `backend/.env` mein `MONGODB_URI=` ke aage daalo.

## B) Live server pe chalana (domain pe)

1. `backend/.env.live.example` ko copy karke naam `backend/.env` rakho, `YAHAN_...` wali jagah apni values bharo.
2. Ye chalao:
```
npm i
npm run seed:live
npm run create-owner -- eshtyle09@gmail.com "Afroaz Kha Saheb Kha"
npm start
```
3. Website port 4000 pe chalegi — hosting / nginx se apne domain ko is port pe point karo.
   Server start na ho to wo khud batayega kaunsi value `.env` mein missing hai.

## C) Email check karna

```
npm run test-email -- apna-email@gmail.com
```
Ye ek test email bhejta hai aur saaf batata hai ki gaya ya nahi, aur nahi gaya to kyun.

## D) Photos / products nahi dikh rahe?

Site chalu rakho (`npm run dev` ya `npm start`), doosre terminal mein `eshtyle` folder mein:
```
npm run doctor
```
Ye check karta hai: photos ka folder, database, products, aur server photos de raha hai ya nahi —
aur har problem ke aage likhta hai kya karna hai.

Live server pe upload karte waqt **`backend/uploads` folder bhi upload karna** — saari photos usi mein hain.

Zyada details: `README.md`, `docs/DEPLOYMENT.md`, `docs/LAUNCH_CHECKLIST.md`.

**Kabhi share mat karna:** `backend/.env`, `backend/ADMIN-LOGIN-LOCAL.txt` (passwords / keys).
