
$(document).ready(function () {

    $('a[href^="#"]').on('click', function (event) {
        event.preventDefault();

        var sc = $(this).attr("href"),
            dn = $(sc).offset().top;

        $('html, body').animate({
            scrollTop: dn
        }, 1000);
    });
});


$(document).ready(function () {
  var wheel = $("#wheel");
  var spinButton = $("#spin-button");
  var spinDuration = 9000;
  var spinAngle = 1080; 
  var modal = $(".modal"); 
  var hasSpun = localStorage.getItem("hasSpun"); 

  if (!hasSpun) {
    spinButton.on("click", function () {
      wheel.css("transition", "transform " + spinDuration + "ms ease-in-out");
      wheel.css("transform", "rotate(" + spinAngle + "deg)");
      setTimeout(function () {
        wheel.css("transition", "none");
        wheel.css("transform", "rotate(0deg)");
      }, spinDuration);


      setTimeout(function () {
        modal.addClass("modal_active");
      }, 10000);


      localStorage.setItem("hasSpun", true);
    });
  } else {

    modal.addClass("modal_active");
  }
});
