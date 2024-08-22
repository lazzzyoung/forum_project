const { MongoClient } = require('mongodb')

const url = process.env.DB_URL // mongodb url 입력
let connectDB = new MongoClient(url).connect()

module.exports = connectDB 