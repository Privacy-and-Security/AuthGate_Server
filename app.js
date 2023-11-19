import bodyParser from 'body-parser';
import express from 'express';
import admin from 'firebase-admin';
import { createRequire } from 'module'; // Bring in the ability to create the 'require' method
const require = createRequire(import.meta.url); // construct the require method
// const serviceAccount = require('./firebase.json');
require('dotenv').config();


const serviceAccount = {
  type: process.env.type,
  project_id: process.env.project_id,
  private_key_id: process.env.private_key_id,
  private_key: process.env.private_key.replace(/\\n/g, '\n'),
  client_email: process.env.client_email,
  client_id: process.env.client_id,
  auth_uri: process.env.auth_uri,
  token_uri: process.env.token_uri,
  auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.client_x509_cert_url,
  universe_domain: process.env.universe_domain,
};

console.log(`serviceAccount ${JSON.stringify(serviceAccount)}`)

// var serviceAccountJson = JSON.parse(myJsonString);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();

const cors = require('cors');

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    // Check if the origin matches the allowed sources
    const allowedSources = [
      'http://127.0.0.1', 'http://localhost',
      'https://127.0.0.1', 'https://localhost'
    ];
    const pattern = /^https?:\/\/(\w+\.)?authgate\.work$/;

    if (allowedSources.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
      callback(null, true);
    } else if (pattern.test(origin)) {
      callback(null, true);
    } else {
      console.log(`origin ${origin}`)
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.get('/', function (req, res) {
  res.send('Hello World!');
});

const port = process.env.PORT || 3000;

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});

const auth = admin.auth();

app.use(bodyParser.json());

app.post('/createUser', async (req, res) => {
  try {
    const { email, password } = req.body;

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


app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'abc' && password === '123456') {
    console.log('Login successfully!');
    res.status(200).send('Login successfully!');
  } else {
    console.log('Wrong password. Provided:', password);
    res.status(401).send('Wrong username or password.'); // 401 表示未授权
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

app.get('/hello', (req, res) => {
  res.send(`Hello`);
});

app.post('/pay', async (req, res) => {
  const data = req.body;

  await db.collection('payments').add(data);

  res.status(200).send('Payment successful');
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500);

  res.json({
    error: {
      message: err.message,
    }
  });
});
