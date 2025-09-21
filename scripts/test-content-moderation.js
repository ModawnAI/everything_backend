#!/usr/bin/env node

/**
 * Test script for Content Moderation Service
 * Tests automated content analysis and moderation functionality
 */

const { contentModerationService } = require('../src/services/content-moderation.service');
const { moderationActionsService } = require('../src/services/moderation-actions.service');
const { moderationRulesService } = require('../src/services/moderation-rules.service');

// Test content samples
const testContents = {
  appropriate: {
    shop_name: "Beautiful Hair Salon",
    shop_description: "Professional hair styling and coloring services. We provide high-quality treatments in a relaxing environment.",
    profile_content: "Welcome to our salon! We offer expert hair services with years of experience."
  },
  
  profanity: {
    shop_name: "Fucking Great Hair Salon",
    shop_description: "This is a shitty description with inappropriate language.",
    profile_content: "We provide damn good services and don't give a fuck about your complaints."
  },
  
  spam: {
    shop_name: "BUY NOW LIMITED TIME OFFER",
    shop_description: "Click here to get rich quick! Act now before it's too late! Free money guaranteed! Work from home and make thousands!",
    profile_content: "URGENT: Limited time offer! Don't miss this opportunity to make money fast!"
  },
  
  harassment: {
    shop_name: "Hair Salon",
    shop_description: "Professional services for those who deserve it. Kill yourself if you don't like our prices.",
    profile_content: "We threaten customers who leave bad reviews. Die if you don't appreciate our work."
  },
  
  inappropriate: {
    shop_name: "Adult Entertainment Services",
    shop_description: "We offer sex services and adult entertainment. Contact us for nude massage and escort services.",
    profile_content: "Drug dealing and prostitution services available. Contact for illegal activities."
  },
  
  phishing: {
    shop_name: "Account Verification Required",
    shop_description: "Your account has been suspended. Click here to verify your password and login information immediately.",
    profile_content: "Urgent: Your account is locked. Update your personal information now to unlock it."
  },
  
  hate_speech: {
    shop_name: "White Power Hair Salon",
    shop_description: "We only serve superior people. No minorities allowed. Nazi supporters welcome.",
    profile_content: "Racist and homophobic establishment. We hate everyone who isn't like us."
  },
  
  fake_content: {
    shop_name: "Fake Luxury Salon",
    shop_description: "This is a scam. We lie about our services. Misleading customers is our specialty.",
    profile_content: "Not a real business. Counterfeit services and fake reviews. Deceive customers daily."
  }
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Utility functions
function logTest(testName, status, message = '') {
  const statusIcon = status === 'PASS' ? '✅' : '❌';
  console.log(`${statusIcon} ${testName}: ${message}`);
  
  if (status === 'PASS') {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push(`${testName}: ${message}`);
  }
}

function logError(testName, error) {
  const message = error.message || 'Unknown error';
  logTest(testName, 'FAIL', message);
}

// Test functions
async function testContentAnalysis() {
  try {
    console.log('\n🧪 Testing: Content Analysis');
    console.log('─'.repeat(50));
    
    const testCases = [
      { name: 'Appropriate Content', content: testContents.appropriate, expectedAppropriate: true },
      { name: 'Profanity Content', content: testContents.profanity, expectedAppropriate: false },
      { name: 'Spam Content', content: testContents.spam, expectedAppropriate: false },
      { name: 'Harassment Content', content: testContents.harassment, expectedAppropriate: false },
      { name: 'Inappropriate Content', content: testContents.inappropriate, expectedAppropriate: false },
      { name: 'Phishing Content', content: testContents.phishing, expectedAppropriate: false },
      { name: 'Hate Speech Content', content: testContents.hate_speech, expectedAppropriate: false },
      { name: 'Fake Content', content: testContents.fake_content, expectedAppropriate: false }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = await contentModerationService.analyzeShopContent(testCase.content);
        
        if (result.overallResult.isAppropriate === testCase.expectedAppropriate) {
          logTest(`${testCase.name} Analysis`, 'PASS', 
            `Score: ${result.overallResult.score}, Severity: ${result.overallResult.severity}, Action: ${result.overallResult.suggestedAction}`);
        } else {
          logTest(`${testCase.name} Analysis`, 'FAIL', 
            `Expected appropriate: ${testCase.expectedAppropriate}, Got: ${result.overallResult.isAppropriate}`);
        }
      } catch (error) {
        logError(`${testCase.name} Analysis`, error);
      }
    }
  } catch (error) {
    logError('Content Analysis Test Suite', error);
  }
}

async function testIndividualContentTypes() {
  try {
    console.log('\n🧪 Testing: Individual Content Type Analysis');
    console.log('─'.repeat(50));
    
    const testCases = [
      { type: 'shop_name', content: 'Fucking Great Salon', expectedViolations: true },
      { type: 'shop_description', content: 'Click here to buy now! Limited time offer!', expectedViolations: true },
      { type: 'profile_content', content: 'We offer professional services in a clean environment.', expectedViolations: false }
    ];
    
    for (const testCase of testCases) {
      try {
        const result = await contentModerationService.analyzeContent(testCase.content, testCase.type);
        
        const hasViolations = result.violations.length > 0;
        if (hasViolations === testCase.expectedViolations) {
          logTest(`${testCase.type} Analysis`, 'PASS', 
            `Violations: ${result.violations.length}, Score: ${result.score}`);
        } else {
          logTest(`${testCase.type} Analysis`, 'FAIL', 
            `Expected violations: ${testCase.expectedViolations}, Got: ${hasViolations}`);
        }
      } catch (error) {
        logError(`${testCase.type} Analysis`, error);
      }
    }
  } catch (error) {
    logError('Individual Content Type Analysis', error);
  }
}

async function testModerationConfiguration() {
  try {
    console.log('\n🧪 Testing: Moderation Configuration');
    console.log('─'.repeat(50));
    
    // Test getting current config
    const currentConfig = contentModerationService.getConfig();
    logTest('Get Configuration', 'PASS', `Block threshold: ${currentConfig.thresholds.block}, Flag threshold: ${currentConfig.thresholds.flag}`);
    
    // Test updating config
    const newConfig = {
      thresholds: {
        block: 90,
        flag: 70,
        low: 30,
        medium: 50,
        high: 70
      },
      enableAutoBlock: true,
      enableAutoFlag: true,
      minConfidence: 80
    };
    
    contentModerationService.updateConfig(newConfig);
    const updatedConfig = contentModerationService.getConfig();
    
    if (updatedConfig.thresholds.block === 90 && updatedConfig.minConfidence === 80) {
      logTest('Update Configuration', 'PASS', 'Configuration updated successfully');
    } else {
      logTest('Update Configuration', 'FAIL', 'Configuration not updated correctly');
    }
    
    // Restore original config
    contentModerationService.updateConfig(currentConfig);
    logTest('Restore Configuration', 'PASS', 'Original configuration restored');
    
  } catch (error) {
    logError('Moderation Configuration', error);
  }
}

async function testViolationDetection() {
  try {
    console.log('\n🧪 Testing: Specific Violation Detection');
    console.log('─'.repeat(50));
    
    const violationTests = [
      {
        name: 'Profanity Detection',
        content: 'This is fucking amazing shit!',
        expectedViolations: ['profanity']
      },
      {
        name: 'Spam Detection',
        content: 'Buy now! Click here! Limited time offer! Act now!',
        expectedViolations: ['spam']
      },
      {
        name: 'Harassment Detection',
        content: 'Kill yourself if you don\'t like our service.',
        expectedViolations: ['harassment']
      },
      {
        name: 'Inappropriate Content Detection',
        content: 'We offer sex services and drug dealing.',
        expectedViolations: ['inappropriate']
      },
      {
        name: 'Phishing Detection',
        content: 'Your account is suspended. Click here to verify your password.',
        expectedViolations: ['phishing']
      },
      {
        name: 'Hate Speech Detection',
        content: 'We only serve white people. Nazis welcome.',
        expectedViolations: ['hate_speech']
      },
      {
        name: 'Fake Content Detection',
        content: 'This is a scam. We lie and deceive customers.',
        expectedViolations: ['fake_content']
      }
    ];
    
    for (const test of violationTests) {
      try {
        const result = await contentModerationService.analyzeContent(test.content, 'shop_description');
        
        const detectedViolationTypes = result.violations.map(v => v.type);
        const expectedTypes = test.expectedViolations;
        
        const hasExpectedViolations = expectedTypes.every(type => detectedViolationTypes.includes(type));
        
        if (hasExpectedViolations) {
          logTest(test.name, 'PASS', 
            `Detected violations: ${detectedViolationTypes.join(', ')}, Score: ${result.score}`);
        } else {
          logTest(test.name, 'FAIL', 
            `Expected: ${expectedTypes.join(', ')}, Detected: ${detectedViolationTypes.join(', ')}`);
        }
      } catch (error) {
        logError(test.name, error);
      }
    }
  } catch (error) {
    logError('Violation Detection', error);
  }
}

async function testSeverityScoring() {
  try {
    console.log('\n🧪 Testing: Severity Scoring');
    console.log('─'.repeat(50));
    
    const severityTests = [
      {
        name: 'Low Severity Content',
        content: 'This is a great service with some minor issues.',
        expectedSeverity: 'low'
      },
      {
        name: 'Medium Severity Content',
        content: 'This fucking service is shit but works okay.',
        expectedSeverity: 'medium'
      },
      {
        name: 'High Severity Content',
        content: 'We offer sex services and adult entertainment for all.',
        expectedSeverity: 'high'
      },
      {
        name: 'Critical Severity Content',
        content: 'Kill yourself if you don\'t like our Nazi services.',
        expectedSeverity: 'critical'
      }
    ];
    
    for (const test of severityTests) {
      try {
        const result = await contentModerationService.analyzeContent(test.content, 'shop_description');
        
        if (result.severity === test.expectedSeverity) {
          logTest(test.name, 'PASS', 
            `Severity: ${result.severity}, Score: ${result.score}, Action: ${result.suggestedAction}`);
        } else {
          logTest(test.name, 'FAIL', 
            `Expected severity: ${test.expectedSeverity}, Got: ${result.severity}`);
        }
      } catch (error) {
        logError(test.name, error);
      }
    }
  } catch (error) {
    logError('Severity Scoring', error);
  }
}

async function testModerationRules() {
  try {
    console.log('\n🧪 Testing: Moderation Rules Service');
    console.log('─'.repeat(50));
    
    // Test getting active rules
    const activeRules = await moderationRulesService.getActiveRules();
    logTest('Get Active Rules', 'PASS', `Found ${activeRules.length} active rules`);
    
    // Test creating a new rule
    const newRule = {
      name: 'Test Rule',
      description: 'Test rule for automated testing',
      rule_type: 'content_filter',
      conditions: [
        {
          field: 'description',
          operator: 'contains',
          value: 'test',
          case_sensitive: false
        }
      ],
      actions: [
        {
          action_type: 'flag',
          parameters: { reason: 'Test content detected' }
        }
      ],
      priority: 50,
      is_active: true
    };
    
    try {
      const createdRule = await moderationRulesService.createRule(newRule);
      logTest('Create Rule', 'PASS', `Created rule with ID: ${createdRule.id}`);
      
      // Test updating the rule
      const updatedRule = await moderationRulesService.updateRule(createdRule.id, {
        description: 'Updated test rule description'
      });
      logTest('Update Rule', 'PASS', 'Rule updated successfully');
      
      // Test toggling rule status
      const toggledRule = await moderationRulesService.toggleRuleStatus(createdRule.id);
      logTest('Toggle Rule Status', 'PASS', `Rule status: ${toggledRule.is_active ? 'active' : 'inactive'}`);
      
      // Test deleting the rule
      await moderationRulesService.deleteRule(createdRule.id);
      logTest('Delete Rule', 'PASS', 'Rule deleted successfully');
      
    } catch (error) {
      logError('Rule Management', error);
    }
    
  } catch (error) {
    logError('Moderation Rules Service', error);
  }
}

async function testEdgeCases() {
  try {
    console.log('\n🧪 Testing: Edge Cases');
    console.log('─'.repeat(50));
    
    const edgeCases = [
      {
        name: 'Empty Content',
        content: '',
        expectedAppropriate: true
      },
      {
        name: 'Null Content',
        content: null,
        expectedAppropriate: true
      },
      {
        name: 'Very Long Content',
        content: 'A'.repeat(10000),
        expectedAppropriate: true
      },
      {
        name: 'Mixed Language Content',
        content: '안녕하세요. This is fucking great! こんにちは. Buy now!',
        expectedAppropriate: false
      },
      {
        name: 'Special Characters',
        content: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        expectedAppropriate: true
      }
    ];
    
    for (const testCase of edgeCases) {
      try {
        const result = await contentModerationService.analyzeContent(testCase.content, 'shop_description');
        
        if (result.isAppropriate === testCase.expectedAppropriate) {
          logTest(testCase.name, 'PASS', 
            `Appropriate: ${result.isAppropriate}, Score: ${result.score}`);
        } else {
          logTest(testCase.name, 'FAIL', 
            `Expected appropriate: ${testCase.expectedAppropriate}, Got: ${result.isAppropriate}`);
        }
      } catch (error) {
        logError(testCase.name, error);
      }
    }
  } catch (error) {
    logError('Edge Cases', error);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Content Moderation Service Tests');
  console.log('=' .repeat(60));
  
  try {
    await testContentAnalysis();
    await testIndividualContentTypes();
    await testModerationConfiguration();
    await testViolationDetection();
    await testSeverityScoring();
    await testModerationRules();
    await testEdgeCases();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
  
  // Print test results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  console.log('\n🏁 Content moderation tests completed');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runTests().catch(console.error);
