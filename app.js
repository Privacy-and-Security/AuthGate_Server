import bodyParser from 'body-parser';
import express from 'express';
import admin from 'firebase-admin';
import { createRequire } from 'module'; // Bring in the ability to create the 'require' method
const require = createRequire(import.meta.url); // construct the require method
const serviceAccount = require('./firebase.json');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

const auth = admin.auth();

app.use(bodyParser.json());

app.post('/createUser', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await auth.createUser({
      password: password,
      email: email,
    });

    await db.collection('users').doc(user.uid).set({
      email: email,
    });

    res.status(200).send('Successfully created new user: ' + user.uid);
  } catch (error) {
    res.status(500).send('Error creating new user: ' + error);
  }
});


// Middleware to authenticate requests
const authenticate = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) return res.status(401).send('Unauthorized');

  const [bearer, token] = authorization.split(' ');
  if (bearer !== 'Bearer') return res.status(401).send('Unauthorized');

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log(`token ${token}`)
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).send('Unauthorized');
  }
};

// Use the middleware in your routes
app.get('/hello', authenticate, (req, res) => {
  // The user's ID is available in req.user.uid
  res.send(`Hello, user ${req.user.uid}`);
});
