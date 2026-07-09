// Simple text-based Wordle game for Synchronet BBSes
// Supports 40-column and 80-column modes
// Rewritten for compatibility with older Synchronet JS engine (no ES6 features)
load("sbbsdefs.js")
load("helpers.js")



/////////////////////////////////////////
// Defaults
//
// Generally shouldn't need to be changed
/////////////////////////////////////////
var MAX_ATTEMPTS = 6;
var WORD_LENGTH = 5;
var STATS_FILE = system.data_dir + "wordle_stats.json"
var CTRL_A = "\x01";
var NEWLINE = "\r\n";



// Load word list from file
var WORDS = [];
var word_file = new File(js.exec_dir + "word-bank.csv");
if (word_file.open("r")) {
    WORDS = word_file.readAll();
    word_file.close();
    for (var i = 0; i < WORDS.length; i++) {
        WORDS[i] = WORDS[i].toUpperCase();
    }
}

// Load word list from file
var VALID_WORDS = [];
word_file = new File(js.exec_dir + "valid-words.csv");
if (word_file.open("r")) {
    VALID_WORDS = word_file.readAll();
    word_file.close();
    for (var i = 0; i < VALID_WORDS.length; i++) {
        VALID_WORDS[i] = VALID_WORDS[i].toUpperCase();
    }
}







////////////////////////////////////////////////////
// "Big Boy" Functions
//
// These are main functions, such as the main menu,
//    Gameplay, etc.
////////////////////////////////////////////////////



// Playing the Game
function playWordle(game_mode) {
    var ANSWERS = [];
    var stats = loadStats();

    var word = "";
    
    if (game_mode === "daily") {
        if (!check_player_can_play(stats)) {
            smartPrint("You've already played today!" + NEWLINE);
            smartPrint("You can try practice mode though!" + NEWLINE); 
            return;
        }
        else {
            word = getDailyWord();
        }
    }
    else if (game_mode === "practice") {
        word = WORDS[Math.floor(Math.random() * WORDS.length)];
    }
    var board = makeEmptyBoard();
    var currentRow = 0;
    var gameOver = false; 
    var board_lines = [];

    var legend_lines = [];
    legend_lines.push(CTRL_A + "K" + CTRL_A + "2" + "(X)" + CTRL_A + "N" + " = Correct");
    legend_lines.push("");
    legend_lines.push(CTRL_A + "K" + CTRL_A + "3" + "!X!" + CTRL_A + "N" + " = Misplaced");
    legend_lines.push("");
    legend_lines.push(CTRL_A + "K" + CTRL_A + "7" + " X " + CTRL_A + "N" + " = Not in word");

    while (!gameOver && currentRow < MAX_ATTEMPTS) {
        console.clear()
        smartPrint(NEWLINE);
        board_lines = generateBoard(board, currentRow, ANSWERS);
        for (var i = 0; i < board_lines.length; i++) {
            if (legend_lines[i]) {
                smartPrint(" " + board_lines[i] + " " + legend_lines[i] + NEWLINE);
            }
            else {
                smartPrint(" " + board_lines[i] + NEWLINE);
            }
        }
        smartPrint(NEWLINE);

        var guess = "";
        smartPrint("Enter your " + WORD_LENGTH + "-letter guess: ");
        while (guess.length !== WORD_LENGTH) {
            guess = console.getstr(WORD_LENGTH, K_UPPER);
            if (guess === null) {
                guess = ""; // user disconnected or aborted input
            }
            if (guess.length !== WORD_LENGTH) {
                guess = "";
                smartPrint("Please enter exactly " + WORD_LENGTH + " letters." + NEWLINE);
            }
            else if (guess.indexOf(" ") !== -1) {
                guess = "";
                smartPrint("Guess cannot include spaces." + NEWLINE);
            }
            else if (VALID_WORDS.indexOf(guess) === -1) {
                guess = "";
                smartPrint("Guess must be a real word." + NEWLINE);
            }
        }
        ANSWERS.push(guess);

        // Check if the guess is correct
        var result = checkGuess(guess, word);
        board[currentRow] = result;

        var allGreen = true;
        var i;
        for (var i = 0; i < result.length; i++) {
            if (result[i] !== "G") {
                allGreen = false;
                break;
            }
        }

        currentRow++;

        if (allGreen) {
            console.clear();
            smartPrint("Winner! You guessed the word: " + word + NEWLINE);
            gameOver = true;
        }
    }

    if (!gameOver) {
        console.clear();
        smartPrint("Game over! The word was: " + word + NEWLINE);
    }

    smartPrint(NEWLINE);
    board_lines = generateBoard(board, currentRow, ANSWERS);
    for (var i = 0; i < board_lines.length; i++) {
        if (legend_lines[i]) {
            smartPrint(" " + board_lines[i] + " " + legend_lines[i] + NEWLINE);
        }
        else {
            smartPrint(" " + board_lines[i] + NEWLINE);
        }
    }
   

    if (game_mode == "daily") {
        if (!stats[user.alias]) {
            stats[user.alias] = {
                lastPlayed: "",
                wins: 0,
                losses: 0,
                streak: 0,
                maxStreak: 0
            }
        }
        var last_date_played = stats[user.alias].lastPlayed;
        stats[user.alias].lastPlayed = get_todays_date();
        // Win or Loss stat
        if(gameOver) {
            stats[user.alias].wins++;
            // streak calculation
            if (check_if_streak_valid(last_date_played)) {
                stats[user.alias].streak++;
            }
            else {
                stats[user.alias].streak = 1;
            }
            if (stats[user.alias].streak > stats[user.alias].maxStreak) {
                stats[user.alias].maxStreak = stats[user.alias].streak;
            }
        }
        else {
            stats[user.alias].losses++;
            stats[user.alias].streak = 0;
        }

        saveStats(stats);
    }
}



function startWordle() {
    // Mainly responsible for the Main Menu, but is also the entry point of the game.
    // Takes in a "mode" that represents whether the user playing is using a 40 or 80 column display. 
    var choice = "";
    while (choice !== "Q") {
        console.clear();
        if (console.screen_columns === 40) {
	        console.printfile(js.exec_dir + "banner.40col.msg"); // 6 Rows

            var intro_page_lines = generate_intro_card();
            for (var i = 0; i < intro_page_lines.length; i++) {
                smartPrint(intro_page_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
            }
            
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
        }
        else {
            console.printfile(js.exec_dir + "banner.msg"); // 13 Rows
            var intro_page_lines = generate_intro_card();
            var scoreboard_lines = generate_scoreboard(5, console.screen_columns);
            smartPrint(NEWLINE, p_mode=P_NOPAUSE);
            for (var i = 0; i < scoreboard_lines.length; i++) {
                if(intro_page_lines[i]) {
                    smartPrint(intro_page_lines[i] + scoreboard_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
                }
                else {
                    smartPrint(centerText("",40) + scoreboard_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
                }
                
            }
            
        }

        
        smartPrint("[D]aily [P]ractice [S]core [Q]uit > ", p_mode=P_NOPAUSE);
        choice = console.getstr(1, K_UPPER);

        if (choice === "D"){
            playWordle("daily");
        }
        else if (choice === "P") {
            playWordle("practice");
        }
        else if (choice === "S") {
            console.clear();
            var scoreboard_lines = generate_scoreboard(15, smartPrint);
            for (var i = 0; i < scoreboard_lines.length; i++) {
                smartPrint(scoreboard_lines[i] + NEWLINE, p_mode=P_NOPAUSE);
            }
        }
    }
}







////////////////////////////
// Main()
// 
// Starts the Game
////////////////////////////

startWordle();
