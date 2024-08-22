// API 쪼개기 연습용
const router = require('express').Router()
// DB 구축
let connectDB = require('./../database.js')

let db
connectDB.then((client)=>{
    db = client.db(process.env.DB_NAME)
  }).catch((err)=>{
  console.log(err)
})

router.get('/shop/shirt',async(request , response)=> {
    
    response.send("여긴 셔츠파는곳");
})  
router.get('/shop/pant',async(request , response)=> {
    
    response.send("여긴 바지 파는곳");
})  

module.exports = router

