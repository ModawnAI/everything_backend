# How to Get FCM Server Key
## Visual Step-by-Step Guide

---

## 🎯 **What You Need**

**FCM Server Key** from Firebase Console - This is the ONLY thing missing to complete your push notification setup!

---

## 📋 **Step-by-Step Instructions**

### **Step 1: Open Firebase Console**

🔗 **Go to:** [https://console.firebase.google.com](https://console.firebase.google.com)

---

### **Step 2: Select Project**

Look for and click on: **e-beautything**

```
┌─────────────────────────────────────────┐
│  Firebase Console                       │
├─────────────────────────────────────────┤
│                                         │
│  My Projects                            │
│  ┌────────────────────────┐            │
│  │  e-beautything         │ ← Click    │
│  │  Project ID: e-beautything         │
│  └────────────────────────┘            │
│                                         │
└─────────────────────────────────────────┘
```

---

### **Step 3: Open Project Settings**

Click the **⚙️ Settings** icon in the top-left corner

```
┌─────────────────────────────────────────┐
│  ⚙️ Settings  ☰  e-beautything         │ ← Click gear icon
├─────────────────────────────────────────┤
│                                         │
│  Click dropdown that appears:           │
│  ┌─────────────────────┐               │
│  │ Project settings    │ ← Click this  │
│  │ Users and permissions│               │
│  │ Usage and billing    │               │
│  └─────────────────────┘               │
│                                         │
└─────────────────────────────────────────┘
```

---

### **Step 4: Navigate to Cloud Messaging Tab**

In Project Settings, click the **Cloud Messaging** tab

```
┌─────────────────────────────────────────┐
│  Project Settings                       │
├─────────────────────────────────────────┤
│  General | Users | Service accounts |   │
│  Cloud Messaging | Integrations         │
│      ↑                                  │
│  Click this tab                         │
└─────────────────────────────────────────┘
```

---

### **Step 5: Enable Cloud Messaging API (If Needed)**

If you see this message:

```
┌─────────────────────────────────────────┐
│  ⚠️ Cloud Messaging API is disabled     │
│                                         │
│  [Enable API]  ← Click this button     │
└─────────────────────────────────────────┘
```

Click **Enable API** and wait ~30 seconds.

---

### **Step 6: Find Server Key**

Scroll down to find the section:

```
┌─────────────────────────────────────────┐
│  Cloud Messaging API (Legacy)           │
├─────────────────────────────────────────┤
│                                         │
│  Server key                             │
│  ┌─────────────────────────────────┐   │
│  │ AAAA...xxxxx...xxxxx            │   │
│  │ (Long key starting with AAAA)   │   │
│  └─────────────────────────────────┘   │
│                 [Copy] ← Click          │
│                                         │
└─────────────────────────────────────────┘
```

**Copy the entire key!** It should look like:
```
AAAAxxxxxxx:APA91bHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### **Step 7: Update .env File**

Open `/home/bitnami/everything_backend/.env` and find this line:

```bash
FCM_SERVER_KEY=your-fcm-server-key-here
```

Replace with your actual key:

```bash
FCM_SERVER_KEY=AAAA_paste_your_copied_key_here
```

**Example:**
```bash
FCM_SERVER_KEY=AAAAxxxxxxx:APA91bHPqL8JxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxGWXSsUX
```

---

### **Step 8: Save and Restart Backend**

```bash
# Save the .env file, then restart:
cd /home/bitnami/everything_backend
npm run dev:clean
```

Or with PM2:
```bash
pm2 restart backend
```

---

### **Step 9: Verify It's Working**

Check logs:
```bash
tail -f logs/combined.log | grep "Firebase"
```

✅ **Success! You should see:**
```
[INFO] Firebase Admin SDK initialized successfully { projectId: 'e-beautything' }
```

---

## 🚨 **Common Issues**

### **Issue 1: "Cloud Messaging API (Legacy)" section not visible**

**Solution:**
1. Make sure you're in the **Cloud Messaging** tab (not General or Service accounts)
2. Scroll down - it might be below other settings
3. If still not visible, the API might need to be enabled first

---

### **Issue 2: "Cloud Messaging API is disabled"**

**Solution:**
1. Click **Enable API** button
2. Wait 30 seconds
3. Refresh the page
4. Server key should now be visible

---

### **Issue 3: Server key field is empty**

**Solution:**
1. Check if you have proper permissions (Owner or Editor role)
2. Try refreshing the page
3. Contact Firebase project administrator if you don't have permissions

---

### **Issue 4: "I can't find the Settings icon"**

**Solution:**
1. Look at the **top-left** corner of Firebase Console
2. It's a ⚙️ gear/cog icon next to your project name
3. Click it to reveal dropdown menu

---

## 📱 **Alternative: Using Firebase CLI**

If you have Firebase CLI installed:

```bash
# Login to Firebase
firebase login

# Get server key (requires jq)
firebase projects:list | grep e-beautything

# Note: Server key retrieval via CLI requires additional setup
# Recommended to use Console UI (steps above)
```

---

## 🎯 **What Happens After You Add the Key?**

1. **Backend initializes Firebase Admin SDK** with your server key
2. **Admin can send push notifications** via `/api/admin/push/send`
3. **Mobile apps can register FCM tokens** via `/api/notifications/register`
4. **Push notifications work end-to-end** 🎉

---

## 📊 **Visual Summary**

```
Firebase Console
    ↓
Select Project (e-beautything)
    ↓
⚙️ Settings → Project Settings
    ↓
Cloud Messaging Tab
    ↓
Enable API (if needed)
    ↓
Scroll to "Cloud Messaging API (Legacy)"
    ↓
Copy Server Key (starts with AAAA)
    ↓
Paste in .env file
    ↓
Restart Backend
    ↓
✅ Done!
```

---

## 🆘 **Still Having Issues?**

1. **Check logs:**
   ```bash
   tail -f logs/error.log
   ```

2. **Verify project ID:**
   ```bash
   grep FCM_PROJECT_ID .env
   # Should show: FCM_PROJECT_ID=e-beautything
   ```

3. **Test backend is running:**
   ```bash
   curl http://localhost:3001/health
   ```

4. **Check Firebase project permissions:**
   - Go to Firebase Console → Project Settings → Users and permissions
   - Make sure you have "Owner" or "Editor" role

---

## 📚 **Next Steps After Getting Key**

1. ✅ Restart backend
2. ✅ Test push notification sending (see [FIREBASE_SETUP_STATUS.md](./FIREBASE_SETUP_STATUS.md))
3. ✅ Configure Flutter mobile app
4. ✅ Test end-to-end notification flow

---

**Time required:** ~5 minutes
**Difficulty:** Easy

**You've got this! 🚀**
