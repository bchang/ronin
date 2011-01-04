package ronin

uses gw.lang.reflect.features.*
uses java.io.Writer
uses java.util.Map
uses java.lang.ThreadLocal
uses javax.servlet.http.HttpServletRequest
uses javax.servlet.http.HttpServletResponse

class RoninController implements IRoninUtils {
 
    @URLMethodValidator
    static function redirect(target : MethodReference) {
      Response.sendRedirect(URLUtil.urlFor(target))
    }

    @URLMethodValidator
    @Deprecated("Block-based methods have been deprecated.  Use urlFor(Foo#bar()) instead.")
    static function redirect(target() : void) {
      Response.sendRedirect(URLUtil.urlFor(target))
    }
    
    static function bounce() {
      var redirectTo = Referrer
      var currentUrl = Request.RequestURL
      if(Request.QueryString?.HasContent) {
        currentUrl.append("?").append(Request.QueryString)
      }
      if(redirectTo == null or redirectTo == currentUrl.toString()) {
        Response.sendRedirect(Request.RootURL)
      } else {
        Response.sendRedirect(redirectTo)
      }
    }

    protected function beforeRequest(params : Map<String, Object>) : boolean {
      return true
    }

    protected function afterRequest(params : Map<String, Object>) {

    }
    
}