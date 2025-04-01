function checkAccount() {
  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;
  let emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    alert("Email không hợp lệ! Vui lòng nhập đúng định dạng.");
    return;
  }

  if (password.length < 6) {
    alert("Mật khẩu phải có ít nhất 6 ký tự!");
    return;
  }

  if (email != "duy@gmail.com") {
    alert("Không tồn tại email");
    return;
  }

  if (password != "duy@gmail.com") {
    alert("Mật khẩu không chinh xác !");
    return;
  }

  window.location.href = "../../../Chart/index.html";
}
