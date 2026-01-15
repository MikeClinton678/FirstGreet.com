/**
 * First Greet AI - Enhanced Setup Script (v2)
 * 
 * Enhanced call flow:
 * 
 * LEGITIMATE CALLS:
 * 1. Screen caller → Put on hold → Call Mike first
 * 2. Brief Mike → Ask "take it or pass?"
 * 3. If "take": Connect caller to Mike
 * 4. If "pass": Return to caller, gather extra info, disconnect
 * 
 * SPAM/UNWANTED CALLS:
 * 1. Mike's phone never rings
 * 2. AI gathers details (advanced voicemail mode)
 * 3. SMS transcript + playback link to Mike
 * 4. Disconnect
 * 
 * Run with: node setup-first-greet.js
 */

const Retell = require('retell-sdk').default;

// ============================================================
// CONFIGURATION
// ============================================================

const RETELL_API_KEY = 'key_6a9dbf8f68e4203fb34e07e6e9e0';
const YOUR_PHONE_NUMBER = '+18479894014';  // Mike's personal number

// ============================================================
// STATE-BASED PROMPTS FOR ENHANCED FLOW
// ============================================================

// General prompt that applies to ALL states
const GENERAL_PROMPT = `## Identity
You are First Greet, a professional AI assistant for Mike. You handle incoming calls on his behalf.

## Your Style
- Warm, professional, conversational
- Natural speech patterns - sound human, not robotic
- Respectful of everyone's time

## Key Rules
- You NEVER directly transfer a call without Mike's approval
- For spam/unwanted calls, Mike's phone should NEVER ring
- Always gather as much useful information as possible
- Be polite even to spam callers - they might be real people`;

// State 1: Initial screening of the caller
const STATE_SCREENING_PROMPT = `## Your Task in This State
You just answered a call from an unknown number. Your job is to:
1. Greet the caller warmly
2. Find out WHO they are and WHY they're calling
3. Decide if this is likely a call Mike would want

## Screening Questions (ask naturally)
- "May I ask who's calling?"
- "And what is this regarding?"
- "Is Mike expecting your call?"

## Decision Criteria

LIKELY WANTED (transition to call_mike state):
- Business opportunities, clients, partners
- Friends, family, or personal acquaintances
- Important or time-sensitive matters
- Someone who knows Mike by name and has a specific reason

LIKELY UNWANTED (transition to voicemail state):
- Telemarketers, sales pitches
- "Extended warranty" or similar scams
- Political calls, surveys
- Vague reasons, won't identify themselves
- Robocalls or recorded messages

## Important
Do NOT tell the caller you're about to call Mike. Just smoothly transition.
If it's a wanted call, say: "Let me check if Mike is available. One moment please."
If it's unwanted, say: "I'd be happy to make sure Mike gets your message."`;

// State 2: Calling Mike for approval (he hears this, not the caller)
const STATE_CALL_MIKE_PROMPT = `## Your Task in This State
You are now connected to Mike. The original caller is on hold and CANNOT hear this conversation.

## What To Do
1. Quickly brief Mike on who's calling and why
2. Ask if he wants to take the call
3. Wait for his response

## Your Script
"Hey Mike, First Greet here. You have a call from [NAME] regarding [REASON]. 
Quick take: [Your 1-sentence assessment of legitimacy/priority].
Do you want me to connect them, or should I take a message?"

## Mike's Response
- If Mike says YES/connect/put them through/take it → Use the connect_caller tool
- If Mike says NO/pass/take a message/not now → Use the return_to_caller tool
- If Mike doesn't answer or you get voicemail → Use the mike_unavailable tool`;

// State 3: Voicemail mode (for unwanted calls - Mike never rang)
const STATE_VOICEMAIL_PROMPT = `## Your Task in This State
This appears to be an unwanted or low-priority call. Mike's phone did NOT ring.
Your job is to act as an intelligent voicemail that gathers useful information.

## Your Approach
Be polite and helpful, making the caller feel heard while extracting details.

## Information to Gather
1. Their full name
2. Company/organization (if applicable)
3. Phone number to call back
4. Detailed reason for calling
5. Best time to reach them
6. Anything else they want Mike to know

## Your Script
"I'd be happy to make sure Mike gets your message. Let me take down some details.
Could you give me your name and the best number to reach you?
And what would you like me to tell Mike?"

## Closing
"Perfect, I've got all that. I'll make sure Mike gets this message and he can reach out if needed. 
Is there anything else you'd like to add before I let you go?"

Then use the end_call tool.

## Remember
Even though this is likely spam, be professional. They might legitimately need Mike someday.`;

// State 4: Taking a message (Mike said "pass" or was unavailable)
const STATE_TAKE_MESSAGE_PROMPT = `## Your Task in This State
Mike either said "pass" on this call or couldn't be reached.
The caller doesn't know this - they think you're checking if Mike is available.

## Your Script
"Thanks for holding. Unfortunately, Mike isn't available to take your call right now.
But I can make sure he gets your message and calls you back."

## Gather
1. Confirm their name
2. Best callback number
3. Any additional message or details
4. Best time to call back

## Closing
"Great, I've got all that. Mike will get back to you as soon as he's able.
Is there anything else you'd like me to pass along?"

Then use the end_call tool.`;

// The greeting message
const BEGIN_MESSAGE = "Hello, thank you for calling. This is First Greet, Mike's assistant. How can I help you today?";

// ============================================================
// MAIN SETUP FUNCTION
// ============================================================

async function setupFirstGreet() {
    console.log('🚀 Starting First Greet Enhanced Setup...\n');

    const client = new Retell({
        apiKey: RETELL_API_KEY,
    });

    try {
        // ---------------------------------------------------------
        // STEP 1: Create the LLM with state machine
        // ---------------------------------------------------------
        console.log('📚 Step 1: Creating LLM with state-based screening...');

        const llm = await client.llm.create({
            model: 'gpt-4.1-mini',
            model_temperature: 0.3,
            start_speaker: 'agent',
            begin_message: BEGIN_MESSAGE,
            general_prompt: GENERAL_PROMPT,

            // Starting state is screening
            starting_state: 'screening',

            // Define the states and their tools
            states: [
                // ========== STATE: SCREENING ==========
                // Initial state - talk to caller, figure out if call is wanted
                {
                    name: 'screening',
                    state_prompt: STATE_SCREENING_PROMPT,
                    edges: [
                        {
                            destination_state_name: 'calling_mike',
                            description: 'Transition when the call seems legitimate and Mike should be consulted. Use this for business, personal, or important calls.'
                        },
                        {
                            destination_state_name: 'voicemail',
                            description: 'Transition when the call is likely spam, telemarketing, or unwanted. Mike should NOT be bothered.'
                        }
                    ],
                    tools: []  // No tools in screening, just transitions
                },

                // ========== STATE: CALLING MIKE ==========
                // Agent initiates warm transfer - speaks to Mike first, then connects or takes message
                {
                    name: 'calling_mike',
                    state_prompt: `## Your Task in This State
You are in a warm transfer. You dialed Mike's number. Here's what happens:

1. You are now speaking TO MIKE (the caller is on hold and cannot hear)
2. Quickly brief Mike: "Hey Mike, First Greet here. You have a call from [NAME] about [REASON]."
3. Then ask: "Press 1 to connect them, or say 'pass' and I'll take a message."
4. Listen for Mike's response

## If Mike accepts (says "yes", "connect", "put them through", or presses 1):
Say "Connecting now" - the caller will be joined to the call automatically.

## If Mike declines (says "no", "pass", "take a message", or presses 2):
Transition to take_message state to return to the caller.

## If Mike doesn't answer or goes to voicemail:
Transition to take_message state.`,
                    tools: [
                        // Warm transfer to Mike's phone
                        {
                            type: 'transfer_call',
                            name: 'transfer_to_mike',
                            description: 'Initiate warm transfer to Mike. You will speak to Mike first while caller is on hold.',
                            transfer_destination: {
                                type: 'predefined',
                                number: YOUR_PHONE_NUMBER
                            },
                            transfer_option: {
                                type: 'warm_transfer',
                                show_transferee_as_caller: false
                            }
                        }
                    ],
                    edges: [
                        {
                            destination_state_name: 'take_message',
                            description: 'Mike declined, said pass, pressed 2, did not answer, or went to voicemail. Return to caller and take a message.'
                        }
                    ]
                },

                // ========== STATE: VOICEMAIL ==========
                // For spam/unwanted - gather info, Mike never called, SMS summary
                {
                    name: 'voicemail',
                    state_prompt: STATE_VOICEMAIL_PROMPT + `

## After Gathering Info
Before ending the call, TEXT Mike a summary using the text_mike_summary tool.`,
                    tools: [
                        {
                            type: 'send_sms',
                            name: 'text_mike_summary',
                            description: 'Send SMS to Mike with call summary after gathering info from caller.',
                            sms_content: {
                                type: 'inferred',
                                prompt: 'Write a brief SMS to Mike summarizing this screened call. Include: caller name, their phone number, what they wanted, and note this was screened as low priority/spam. Keep it under 160 characters if possible.'
                            }
                        },
                        {
                            type: 'end_call',
                            name: 'end_call',
                            description: 'End the call after gathering info and sending SMS to Mike.'
                        }
                    ],
                    edges: []
                },

                // ========== STATE: TAKE MESSAGE ==========
                // Mike declined or unavailable - take message, SMS summary
                {
                    name: 'take_message',
                    state_prompt: STATE_TAKE_MESSAGE_PROMPT + `

## After Taking the Message
TEXT Mike the message using the text_mike_message tool.`,
                    tools: [
                        {
                            type: 'send_sms',
                            name: 'text_mike_message',
                            description: 'Send SMS to Mike with the caller message after taking their info.',
                            sms_content: {
                                type: 'inferred',
                                prompt: 'Write a brief SMS to Mike with this message. Include: caller name, callback number, their message, and best time to call back. Keep it concise.'
                            }
                        },
                        {
                            type: 'end_call',
                            name: 'end_call',
                            description: 'End the call after taking message and sending SMS to Mike.'
                        }
                    ],
                    edges: []
                }
            ],

            // General tools available in all states
            general_tools: [
                {
                    type: 'end_call',
                    name: 'emergency_end',
                    description: 'Only use if the caller hangs up, becomes abusive, or an unexpected error occurs.'
                }
            ]
        });

        console.log(`   ✅ LLM created: ${llm.llm_id}\n`);

        // ---------------------------------------------------------
        // STEP 2: Get existing First Greet agent and update it
        // ---------------------------------------------------------
        console.log('🎤 Step 2: Updating First Greet agent...');

        // First, find the existing First Greet agent
        const agents = await client.agent.list();
        let firstGreetAgent = agents.find(a => a.agent_name === 'First Greet');

        if (firstGreetAgent) {
            // Update existing agent with new LLM
            console.log('   Found existing agent, updating...');
            firstGreetAgent = await client.agent.update(firstGreetAgent.agent_id, {
                response_engine: {
                    type: 'retell-llm',
                    llm_id: llm.llm_id
                }
            });
            console.log(`   ✅ Agent updated: ${firstGreetAgent.agent_id}\n`);
        } else {
            // Create new agent
            console.log('   Creating new agent...');
            firstGreetAgent = await client.agent.create({
                response_engine: {
                    type: 'retell-llm',
                    llm_id: llm.llm_id
                },
                voice_id: '11labs-Grace',
                agent_name: 'First Greet',
                version_description: 'Enhanced call screening with Mike approval and voicemail mode',
                language: 'en-US',
                voice_speed: 1.0,
                responsiveness: 0.9,
                interruption_sensitivity: 0.7,
                enable_backchannel: true,
                backchannel_frequency: 0.6,
                enable_voicemail_detection: true,
                voicemail_message: "Hi, this is First Greet. Mike will return your call soon.",
                end_call_after_silence_ms: 30000,
                max_call_duration_ms: 3600000
            });
            console.log(`   ✅ Agent created: ${firstGreetAgent.agent_id}\n`);
        }

        // ---------------------------------------------------------
        // STEP 3: Verify phone number is bound correctly
        // ---------------------------------------------------------
        console.log('📞 Step 3: Verifying phone number binding...');

        const phoneNumbers = await client.phoneNumber.list();
        const firstGreetNumber = phoneNumbers.find(p => p.nickname && p.nickname.includes('First Greet'));

        if (firstGreetNumber) {
            // Make sure it's bound to the updated agent
            if (firstGreetNumber.inbound_agent_id !== firstGreetAgent.agent_id) {
                await client.phoneNumber.update(firstGreetNumber.phone_number, {
                    inbound_agent_id: firstGreetAgent.agent_id,
                    outbound_agent_id: firstGreetAgent.agent_id
                });
                console.log('   ✅ Phone number re-bound to updated agent\n');
            } else {
                console.log(`   ✅ Phone number already bound: ${firstGreetNumber.phone_number_pretty}\n`);
            }
        }

        // ---------------------------------------------------------
        // SUCCESS!
        // ---------------------------------------------------------
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎉 FIRST GREET ENHANCED SETUP COMPLETE!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        console.log('📋 Summary:');
        console.log(`   • LLM ID:        ${llm.llm_id}`);
        console.log(`   • Agent ID:      ${firstGreetAgent.agent_id}`);
        console.log(`   • Phone Number:  ${firstGreetNumber?.phone_number_pretty || 'Check dashboard'}`);
        console.log('');
        console.log('🔄 New Call Flow:');
        console.log('   1. Caller reaches First Greet');
        console.log('   2. AI screens → Legitimate? → Calls Mike for approval');
        console.log('   3. Mike says "take it" → Connects | "pass" → Takes message');
        console.log('   4. Spam detected → Voicemail mode (Mike never rings)');
        console.log('');
        console.log('⚠️  Note: SMS notifications require additional webhook setup.');
        console.log('═══════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error('   Full error:', JSON.stringify(error, null, 2));
        throw error;
    }
}

setupFirstGreet()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
