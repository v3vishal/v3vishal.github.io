const letters = "VishalVVv3vishal()!@#";
const letterss = letters

let interval = null;
let iinterval = interval;

h1 = document.querySelector("h1")
h2 = document.querySelector("h2")
ghl = document.getElementById("ghl")

window.onload = function() {
  Particles.init({
    selector: '.pbg',
    color: '#00aeff',
    connectParticles: true,
    maxParticles: 100,
    minDistance: 100
  });
};

ghl.style.height = `${h2.offsetHeight - 15}px`

h1.onmouseover = event => {  
  let iteration = 0;
  
  clearInterval(interval);
  
  interval = setInterval(() => {
    event.target.innerText = event.target.innerText
      .split("")
      .map((letter, index) => {
        if(index < iteration) {
          return event.target.dataset.value[index];
        }
      
        return letters[Math.floor(Math.random() * 21)]
      })
      .join("");
    
    if(iteration >= event.target.dataset.value.length){ 
      clearInterval(interval);
    }
    
    iteration += 1;
  }, 30);
}
h2.onmouseover = event => {  
    let iteration = 0;
    
    clearInterval(iinterval);
    
    iinterval = setInterval(() => {
      event.target.innerText = event.target.innerText
        .split("")
        .map((letter, index) => {
          if(index < iteration) {
            return event.target.dataset.value[index];
          }
        
          return letterss[Math.floor(Math.random() * 21)]
        })
        .join("");
      
      if(iteration >= event.target.dataset.value.length){ 
        clearInterval(iinterval);
      }
      
      iteration += 1;
    }, 30);
  }