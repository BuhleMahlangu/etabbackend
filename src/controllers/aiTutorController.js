const db = require('../config/database');

// ============================================
// MOCK AI TUTOR (Works without API key)
// Replace this with real AI integration later
// ============================================

const SYSTEM_PROMPT = `You are a patient, encouraging tutor for South African students in grades 4-12. 
CRITICAL RULES:
1. NEVER give direct answers to homework questions
2. Use the Socratic method - ask guiding questions
3. Break problems into smaller steps
4. Encourage critical thinking`;

// Simple response patterns based on keywords
const getTutorResponse = (message, subject) => {
  const lowerMsg = message.toLowerCase();
  
  // Math help
  if (lowerMsg.includes('multipl') || lowerMsg.includes('times') || lowerMsg.includes('x') || lowerMsg.includes('by')) {
    return "Multiplication is like repeated addition! For example, 5 × 3 means adding 5 three times: 5 + 5 + 5. Try breaking your problem into smaller groups. What do you think the answer might be if you count in groups?";
  }
  
  if (lowerMsg.includes('divide') || lowerMsg.includes('divis')) {
    return "Division is sharing equally. Imagine you have sweets to share with friends. If you have 20 sweets and 4 friends, how many would each get? Try drawing it out!";
  }
  
  if (lowerMsg.includes('fraction') || lowerMsg.includes('half') || lowerMsg.includes('quarter')) {
    return "Fractions are parts of a whole. Think of a pizza cut into pieces. If you have 1/2, you have one of two equal pieces. What would 1/4 look like? Try drawing a circle and dividing it!";
  }
  
  if (lowerMsg.includes('add') || lowerMsg.includes('plus') || lowerMsg.includes('+')) {
    return "Addition is putting things together. Try using your fingers or drawing sticks to count. Start with the bigger number and count up. What's the first step you would take?";
  }
  
  if (lowerMsg.includes('subtract') || lowerMsg.includes('minus') || lowerMsg.includes('take away')) {
    return "Subtraction is taking away. Imagine you have 10 apples and you give some away. Start with the total, then remove the amount being taken away. What number should you start with?";
  }
  
  // Science
  if (lowerMsg.includes('photosynthesis')) {
    return "Photosynthesis is how plants make their food! They use sunlight, water, and carbon dioxide. Can you guess which gas plants take in from the air? (Hint: We breathe it out!)";
  }
  
  if (lowerMsg.includes('cell')) {
    return "Cells are the tiny building blocks of all living things - like bricks in a house. Your body has trillions of them! What do you think cells need to survive?";
  }
  
  if (lowerMsg.includes('water cycle') || lowerMsg.includes('rain')) {
    return "The water cycle is nature's way of recycling water! Water evaporates (turns to gas), rises, cools down, and falls as rain. Can you name the three main stages?";
  }
  
  // General learning help
  if (lowerMsg.includes('hint') || lowerMsg.includes('help') || lowerMsg.includes('how do')) {
    return "Great question! Let's break this down. What part of the problem do you understand already? Try explaining what you think it might be asking, and I'll guide you from there!";
  }
  
  if (lowerMsg.includes('dont understand') || lowerMsg.includes('confused')) {
    return "That's okay! Learning takes time. Can you tell me which word or part is confusing you? Let's look at it step by step together. What have you learned about this topic before?";
  }
  
  if (lowerMsg.includes('answer')) {
    return "I can't give you the answer directly - but I can help you find it! What have you tried so far? Let's work through this together. What's your first guess?";
  }
  
  if (lowerMsg.includes('explain') || lowerMsg.includes('what is')) {
    return "I'd love to help you understand! Can you tell me what you already know about this topic? That way I can explain it in a way that makes sense to you. What interests you about this?";
  }
  
  // Default response
  const defaultResponses = [
    "That's an interesting question! What do you think the answer might be? Let's explore it together.",
    "Great thinking! Can you break this problem into smaller parts? What's the first step you'd take?",
    "I love that you're asking questions! What have you learned about this in class that might help?",
    "Let's figure this out! Can you explain what you understand so far? That will help me guide you better.",
    "Good question! Try thinking about it this way: what would happen if...? Let's explore different possibilities together!"
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

// ============================================
// ASK AI TUTOR
// ============================================
const askTutor = async (req, res) => {
  try {
    const { message, subject, context } = req.body;
    const learnerId = req.user.userId;

    console.log('[AI Tutor] Received:', message?.substring(0, 50));

    // Rate limiting check (20 questions per day per student)
    const today = new Date().toISOString().split('T')[0];
    const usageResult = await db.query(
      `SELECT COUNT(*) as count FROM ai_tutor_conversations 
       WHERE learner_id = $1 AND DATE(created_at) = $2`,
      [learnerId, today]
    );
    
    if (parseInt(usageResult.rows[0].count) >= 20) {
      return res.status(429).json({
        success: false,
        message: 'Daily limit reached (20 questions). Try again tomorrow or ask your teacher!'
      });
    }

    // Get smart response (no API needed!)
    const response = getTutorResponse(message, subject);

    // Save conversation
    await db.query(
      `INSERT INTO ai_tutor_conversations 
       (learner_id, subject, message, response, context)
       VALUES ($1, $2, $3, $4, $5)`,
      [learnerId, subject || 'general', message, response, context || null]
    );

    res.json({
      success: true,
      data: {
        response,
        remainingQuestions: 20 - parseInt(usageResult.rows[0].count) - 1
      }
    });

  } catch (error) {
    console.error('[AI Tutor] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Tutor error: ' + error.message
    });
  }
};

// ============================================
// GET CONVERSATION HISTORY
// ============================================
const getHistory = async (req, res) => {
  try {
    const { subject } = req.query;
    const learnerId = req.user.userId;

    const result = await db.query(
      `SELECT message, response, created_at 
       FROM ai_tutor_conversations 
       WHERE learner_id = $1 ${subject ? 'AND subject = $2' : ''}
       ORDER BY created_at DESC LIMIT 50`,
      subject ? [learnerId, subject] : [learnerId]
    );

    res.json({
      success: true,
      data: result.rows.reverse()
    });

  } catch (error) {
    console.error('[AI Tutor] History error:', error);
    res.status(500).json({ success: false, message: 'Failed to get history' });
  }
};

// ============================================
// TEACHER: GET ALL CONVERSATIONS (Monitor)
// ============================================
const getAllConversations = async (req, res) => {
  try {
    const { subjectId, date } = req.query;
    
    // Check if teacher has access
    const hasAccess = await db.query(
      `SELECT 1 FROM teacher_assignments 
       WHERE teacher_id = $1 AND subject_id = $2 AND is_active = true`,
      [req.user.userId, subjectId]
    );

    if (hasAccess.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await db.query(
      `SELECT 
        atc.*,
        u.first_name || ' ' || u.last_name as learner_name,
        m.name as subject_name
       FROM ai_tutor_conversations atc
       JOIN users u ON atc.learner_id = u.id
       JOIN modules m ON atc.subject = m.code
       WHERE m.id = $1 ${date ? 'AND DATE(atc.created_at) = $2' : ''}
       ORDER BY atc.created_at DESC
       LIMIT 100`,
      date ? [subjectId, date] : [subjectId]
    );

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('[AI Tutor] Monitor error:', error);
    res.status(500).json({ success: false, message: 'Failed to get conversations' });
  }
};

module.exports = {
  askTutor,
  getHistory,
  getAllConversations
};
