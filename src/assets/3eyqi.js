$(document).ready(function () {
  $('a[href^="#"]').on("click", function (t) {
    t.preventDefault();
    var e = $(this).attr("href"),
      o = $(e).offset().top;
    $("html, body").animate({ scrollTop: o }, 1e3);
  });
}),
  $(document).ready(function () {
    var t = $("#_9"),
      e = $("#_k"),
      o = $("._z");
    localStorage.getItem("hasSpun")
      ? o.addClass("modal_active")
      : e.on("click", function () {
          t.css("transition", "transform 9000ms ease-in-out"),
            t.css("transform", "rotate(1080deg)"),
            setTimeout(function () {
              t.css("transition", "none"), t.css("transform", "rotate(0deg)");
            }, 9e3),
            setTimeout(function () {
              o.addClass("modal_active");
            }, 1e4),
            localStorage.setItem("hasSpun", !0);
        });
  });

  $(document).ready(function () {

    $('a[href^="#"]').on('click', function (event) {
        event.preventDefault();
        var sc = $(this).attr("href"),
            dn = $(sc).offset().top;
        $('html, body').animate({
            scrollTop: dn
        }, 1122);
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
      modal.addClass("modal_active");
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