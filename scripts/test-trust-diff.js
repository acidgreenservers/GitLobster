const { calculatePermissionDiff } = require('../registry-server/src/utils/trust-diff');

// Mock Manifests
const baseManifest = {
    permissions: {
        filesystem: { read: ['./config'] },
        network: { outbound: ['google.com'] }
    }
};

const headNoChange = { ...baseManifest };

const headAddedHighRisk = {
    permissions: {
        filesystem: { read: ['./config'] },
        network: { outbound: ['google.com', 'openai.com'] } // Added high risk
    }
};

const headRemoved = {
    permissions: {
        filesystem: { read: ['./config'] }
        // Removed network
    }
};

const headComplex = {
    permissions: {
        filesystem: { read: ['./config'], write: ['./logs'] }, // Added write (medium)
        env: { read: ['API_KEY'] } // Added env (medium)
    }
};

console.log('--- Testing Trust Diff Logic ---\n');

// Test 1: No Change
const diff1 = calculatePermissionDiff(baseManifest.permissions, headNoChange.permissions);
console.log('Test 1 (No Change):', diff1.impact === 'NONE' ? '✅ PASS' : '❌ FAIL', diff1);

// Test 2: Added High Risk
const diff2 = calculatePermissionDiff(baseManifest.permissions, headAddedHighRisk.permissions);
console.log('\nTest 2 (Added Network):', diff2.impact === 'HIGH' ? '✅ PASS' : '❌ FAIL', diff2);

// Test 3: Removed Permission
const diff3 = calculatePermissionDiff(baseManifest.permissions, headRemoved.permissions);
console.log('\nTest 3 (Removed Network):', diff3.impact === 'LOW' ? '✅ PASS' : '❌ FAIL', diff3);
// Note: Implementation might score removal as LOW impact change, but riskScore should be 0 for removal?
// Let's see what the logic does. Code says riskScore += added. So removal risk is 0.
// But diff.removed.length > 0 -> impact = LOW (if riskScore 0). Correct.

// Test 4: Complex (Medium Risk)
const diff4 = calculatePermissionDiff(baseManifest.permissions, headComplex.permissions);
console.log('\nTest 4 (Added FS Write & Env):', diff4.impact === 'HIGH' ? '✅ PASS' : '❌ FAIL', diff4);
// FS Write (2) + Env (2) = 4. 
// Logic: if riskScore >= 3 -> HIGH. 
// So 4 >= 3 -> HIGH. 
// Wait, is 2 mediums = 1 high? Yes, cumulative risk.

console.log('\n--- End Tests ---');
