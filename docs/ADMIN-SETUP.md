# Admin & Student Setup — EZEE VISION CHAMPUA

## 1. Firebase Authentication

Open:

Firebase Console → Authentication → Sign-in method

Enable:

**Email/Password**

Google is not required by this version.

## 2. Create the admin password account

The Admin Panel expects:

```text
Admin email: creativesayeedd@gmail.com
```

The account must be usable with Firebase **Email/Password** authentication.

If this address currently exists only as a Google-provider user, it may not have a password credential. In that case, create/reconfigure the Firebase Authentication account so Email/Password is available for this admin email before using the Admin Panel.

## 3. Realtime Database rules

Deploy the rules in:

```text
firebase/database.rules.json
```

The rules allow privileged writes only for the authenticated admin email and protect each student's own profile/recent area.

## 4. Storage rules

Deploy:

```text
firebase/storage.rules
```

Only the authenticated admin email can write/delete under `study-materials/`. Authenticated users can read material files so the protected reader and worksheet download can function.

## 5. Admin login

Open:

```text
admin.html
```

The email is prefilled as:

`creativesayeedd@gmail.com`

Enter the admin password and tap:

**Login as Admin**

There is no Google login and no Bootstrap/Admin-claim button.

## 6. Create a student

Admin Panel → Students → Add Student

Example:

```text
Student name: Rahul Kumar
Student ID: EV001
Password: Rahul@123
Class: 10
```

After creation the app shows a one-time credentials dialog.

Give the student:

```text
ID: EV001
Password: Rahul@123
Class: 10
```

The internal Firebase email is generated automatically and does not need to be shared.

## 7. Student login

Students open `index.html` and enter:

```text
Student ID: EV001
Password: Rahul@123
```

The app automatically resolves the internal Firebase identity and then loads only the student's assigned class.

## 8. If a student is disabled

Admin → Students → Disable

The student's profile becomes inactive. The learning application will reject the account even if the password is correct.

## 9. If a student needs a new password

This simple client-only edition intentionally does not show a password-reset button for students. An administrator who needs secure password changes should use a trusted backend or manually manage the Firebase Authentication credential.

## 10. Cost

This edition intentionally removes Cloud Functions, so the portal does not need Functions deployment or the Blaze plan simply for student-account management. Firebase Authentication, Realtime Database and Storage still have their own quotas/pricing and should be reviewed in the Firebase Console.
