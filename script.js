let level = 1;
let sequence = [];
let userSequence = [];
let playing = false;

var colors = ['red', 'blue', 'green', 'yellow'];

function flash(color) {
    var box = document.querySelector('[data-color="' + color + '"]');
    box.classList.add('active');
    
    try {
        var sound = new Audio('sounds/' + color + '.wav');
        sound.volume = 1;
        sound.play().catch(function(err) {
            console.log('Sound error');
        });
    } catch(e) {
        console.log('Error playing sound');
    }
    
    setTimeout(function() {
        box.classList.remove('active');
    }, 500);
}

function playSequence() {
    playing = false;
    sequence = [];
    
    var k = 0;
    while (k < level) {
        var randomColor = colors[Math.floor(Math.random() * 4)];
        sequence.push(randomColor);
        k = k + 1;
    }
    
    document.getElementById('instruction').textContent = 'Watch ' + level + ' boxes!';
    
    var i = 0;
    function showNext() {
        if (i < sequence.length) {
            flash(sequence[i]);
            i = i + 1;
            setTimeout(showNext, 600);
        } else {
            userSequence = [];
            playing = true;
            document.getElementById('instruction').textContent = 'Your turn! Click in order';
        }
    }
    showNext();
}

var boxes = document.querySelectorAll('.box');
var j = 0;
while (j < boxes.length) {
    boxes[j].addEventListener('click', function(e) {
        if (!playing) return;
        
        var color = e.target.getAttribute('data-color');
        userSequence.push(color);
        flash(color);
        
        var lastUserColor = userSequence[userSequence.length - 1];
        var expectedColor = sequence[userSequence.length - 1];
        
        if (lastUserColor !== expectedColor) {
            document.getElementById('message').textContent = 'Wrong! Game Over!';
            document.getElementById('message').classList.add('error');
            level = 1;
            sequence = [];
            playing = false;
            return;
        }
        
        if (userSequence.length === sequence.length) {
            level = level + 1;
            document.getElementById('level').textContent = level;
            document.getElementById('message').textContent = 'Correct!';
            document.getElementById('message').classList.remove('error');
            playing = false;
            setTimeout(playSequence, 1000);
        }
    });
    j = j + 1;
}

document.getElementById('startBtn').addEventListener('click', function() {
    level = 1;
    sequence = [];
    document.getElementById('level').textContent = level;
    document.getElementById('message').textContent = '';
    playSequence();
});
