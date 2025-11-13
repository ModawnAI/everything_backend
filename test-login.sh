#!/bin/bash

curl -X POST http://localhost:3001/api/shop-owner/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"shopowner@test.com","password":"Test1234!"}' \
  -w "\nHTTP Status: %{http_code}\n"
