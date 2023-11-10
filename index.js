const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
	origin: [
		'http://localhost:5173',
		// 'https://car-doctor-a5f92.web.app',
		// 'https://car-doctor-a5f92.firebaseapp.com'
	],
	credentials: true
}));
app.use(express.json());
app.use(cookieParser())


// const uri = 'mongodb://localhost:27017';

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fx0bzv8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	}
});

// middleware
const logger = (req, res, next) => {
	console.log('log: info', req.method, req.url);
	next();
}

const verifyToken = (req, res, next) => {
	const token = req?.cookies?.token;
	if(!token){
		return res.status(401).send({message: 'unauthorized access'})
	}
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if(err){
			return res.status(401).send({message: 'unauthorized access'})
		}
		req.user = decoded;
		next();
	})
}



async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		// await client.connect();

		const serviceCollections = client.db('carDoctor').collection('services');
		const bookingCollections = client.db('carDoctor').collection('bookings');


		// auth related
		app.post('/jwt', logger, (req, res) => {
			const user = req.body;
			console.log('user for token', user)
			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
			res
				.cookie('token', token, {
					httpOnly: true,
					secure: true,
					sameSite: 'none'
				})
				.send({ success: true })
		})

		app.post('/logout', logger, async (req, res) => {
			const user = req.body;
			console.log('logging out', user);
			res.clearCookie('token', { maxAge: 0 }).send({ success: true })
		})


		// services related api , logger
		app.get('/services', logger, async (req, res) => {
			const filter = req.query;
			console.log(filter);
			let sort = {
				title: {$regex: filter.search, $options: 'i'}
			}
			const options = {
				sort: {
					price: filter.sort === 'asc' ? 1 : -1
				}
			}
			const cursor = serviceCollections.find(sort, options)
			const result = await cursor.toArray();
			res.send(result);
		})

		app.get('/services/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const options = {
				projection: { title: 1, price: 1, service_id: 1, img: 1 },
			};
			const result = await serviceCollections.findOne(query, options)
			res.send(result);
		})


		// bookings , logger, verifyToken
		app.get('/bookings', logger, verifyToken, async (req, res) => {
			console.log(req.query.email);
			console.log("cook cookies", req.user);
			// check user data
			if(req.user.email !== req.query.email){
				return res.status(403).send({message: 'forbidden access'})
			}
		
			let query = {}
			if (req.query?.email) {
				query = { email: req.query.email }
			}
			const result = await bookingCollections.find(query).toArray();
			res.send(result);
		})

		app.post('/bookings', async (req, res) => {
			const bookings = req.body;
			console.log(bookings);
			const result = await bookingCollections.insertOne(bookings)
			res.send(result);
		})

		// booking delete
		app.delete('/bookings/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) }
			const result = await bookingCollections.deleteOne(query)
			res.send(result);
		})

		// booking update
		app.patch('/bookings/:id', async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const updateBooking = req.body;
			console.log(updateBooking);
			const updateDoc = {
				$set: {
					status: updateBooking.status
				},
			};
			const result = await bookingCollections.updateOne(filter, updateDoc);
			res.send(result);
		})

		// shorting service
		

		


		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log("Pinged your deployment. You successfully connected to MongoDB!");
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);




app.get('/', (req, res) => {
	res.send("car doctor server is running!!");
})
app.listen(port, () => {
	console.log(`server in running ${port}`);
})