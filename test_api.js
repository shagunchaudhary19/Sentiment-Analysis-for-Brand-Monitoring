/**
 * Headless API Verification Test
 * Simulates a full user session to verify all SaaS endpoints.
 */

const axios = require('axios');
const http = require('http');

const axiosInstance = axios.create({
    baseURL: 'http://localhost:4001',
    validateStatus: () => true,
    withCredentials: true
});

async function runTests() {
    console.log("🚀 Starting API Verification Tests...");

    try {
        // 1. Test Signup
        console.log("\n[1] Testing Signup...");
        const signupRes = await axiosInstance.post('/api/auth/signup', {
            email: `test_${Date.now()}@example.com`,
            password: 'password123',
            name: 'Test Inspector'
        });
        
        if (signupRes.status !== 200) {
            console.error("❌ Signup Failed:", signupRes.data);
            process.exit(1);
        }
        console.log("✅ Signup Successful!");

        // Extract cookie
        const cookie = signupRes.headers['set-cookie'];
        const headers = { 'Cookie': cookie[0] };

        // 2. Test Me
        console.log("\n[2] Testing Auth Session (/api/auth/me)...");
        const meRes = await axiosInstance.get('/api/auth/me', { headers });
        if (meRes.status !== 200) {
            console.error("❌ Auth Check Failed:", meRes.data);
            process.exit(1);
        }
        console.log("✅ Auth Session Verified!");

        // 3. Test Brands
        console.log("\n[3] Testing Brand Retrieval...");
        const brandsRes = await axiosInstance.get('/api/brands', { headers });
        if (brandsRes.status !== 200 || !brandsRes.data.brands.length) {
            console.error("❌ Brand Retrieval Failed:", brandsRes.data);
            process.exit(1);
        }
        console.log(`✅ Brands Loaded: ${brandsRes.data.brands.length}`);

        // 4. Test Mentions
        console.log("\n[4] Testing Mentions Data...");
        const mentionsRes = await axiosInstance.get('/api/mentions', { headers });
        if (mentionsRes.status !== 200) {
            console.error("❌ Mentions Retrieval Failed:", mentionsRes.data);
            process.exit(1);
        }
        console.log(`✅ Mentions Loaded: ${mentionsRes.data.mentions.length}`);

        // 5. Test AI Insights
        console.log("\n[5] Testing AI Insights...");
        const aiRes = await axiosInstance.post('/api/ai/insights', { 
            brand: brandsRes.data.brands[0].brand_name 
        }, { headers });
        if (aiRes.status !== 200 || !aiRes.data.insight) {
            console.error("❌ AI Insights Failed:", aiRes.data);
            process.exit(1);
        }
        console.log("✅ AI Insights Verified!");

        console.log("\n🏆 ALL CORE SaaS FEATURES WORKING PROPERLY!");
        process.exit(0);

    } catch (err) {
        console.error("\n💥 Critical Test Error:", err.message);
        process.exit(1);
    }
}

runTests();
