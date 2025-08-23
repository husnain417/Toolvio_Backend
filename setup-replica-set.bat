@echo off
echo ========================================
echo MongoDB Replica Set Setup Script
echo ========================================
echo.

echo This script will help you set up MongoDB with replication enabled.
echo You need to run this as Administrator.
echo.

echo Step 1: Stopping MongoDB service...
net stop MongoDB
if %errorlevel% neq 0 (
    echo ERROR: Failed to stop MongoDB service. Make sure you're running as Administrator.
    pause
    exit /b 1
)
echo MongoDB service stopped successfully.
echo.

echo Step 2: Creating backup of MongoDB config...
copy "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg" "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg.backup"
echo Backup created.
echo.

echo Step 3: Starting MongoDB with replication enabled...
echo Starting MongoDB manually with replication...
start "MongoDB with Replication" "C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" --replSet rs0 --dbpath "C:\Program Files\MongoDB\Server\8.0\data"

echo.
echo MongoDB is now starting with replication enabled.
echo Wait for it to fully start (you'll see connection messages).
echo.
echo Step 4: In a new Command Prompt, run:
echo "C:\Program Files\MongoDB\Server\8.0\bin\mongosh.exe"
echo.
echo Step 5: Then run this command in mongosh:
echo rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] })
echo.
echo Step 6: After replica set is initialized, you can start your application.
echo.
pause
