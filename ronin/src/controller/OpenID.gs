package controller

uses ronin.*

uses java.lang.*
uses java.util.*
uses gw.util.*
uses gw.xml.simple.SimpleXmlNode

uses javax.crypto.Mac
uses javax.crypto.spec.SecretKeySpec
uses org.apache.commons.codec.binary.Base64

uses org.apache.http.client.methods.*
uses org.apache.http.impl.client.*

@NoAuth
class OpenID extends RoninController {

  // TODO support immediate mode
  
  function login(providerURL : String, redirectTo : String) {
    if(AuthManager == null) {
      throw "Auth manager must be configured in order to use OpenID authentication."
    }
    Session["__ronin_openid_provider"] = providerURL
    Session["__ronin_openid_referrer"] = redirectTo ?: Referrer
    var nonce = UUID.randomUUID().toString()
    Session["__ronin_openid_nonce"] = nonce
    var oidResponse = new DefaultHttpClient().execute(new HttpGet(providerURL))
    var oidResponseText = ""
    try {
      oidResponseText = StreamUtil.getContent(StreamUtil.getInputStreamReader(oidResponse.Entity.Content))
      var oidXml = SimpleXmlNode.parse(oidResponseText)
      var oidURL = oidXml.Children.firstWhere(\n -> n.Name == "XRD")
        .Children.firstWhere(\n -> n.Name == "Service")
        .Children.firstWhere(\n -> n.Name == "URI").Text
      Session["__ronin_openid_provider_resolved"] = oidURL
      var assocHandle = getAssocHandle(oidURL)
      Response.sendRedirect(oidURL +
        "?openid.ns=http://specs.openid.net/auth/2.0" +
        "&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select" +
        "&openid.identity=http://specs.openid.net/auth/2.0/identifier_select" +
        "&openid.return_to=${urlFor(#complete(nonce))}" +
        "&openid.realm=${Request.RootURL}" +
        "&openid.mode=checkid_setup" +
        "&openid.assoc_handle=${assocHandle.Handle}" +
        "&openid.ns.ax=http://openid.net/srv/ax/1.0" +
        "&openid.ax.mode=fetch_request" +
        "&openid.ax.type.email=http://axschema.org/contact/email" +
        "&openid.ax.required=email"
      )
    } catch(e) {
      e.printStackTrace()
      throw "Invalid response from OpenID provider: ${oidResponseText}"
    }
  }

  function complete(nonce : String) {
    try {
      if(nonce == Session["__ronin_openid_nonce"] as String and Request.getParameter("openid.mode") == "id_res") {
        var provider = Request.getParameter("openid.op_endpoint")
        if(provider == Session["__ronin_openid_provider_resolved"] as String) {
          var assocHandle = getAssocHandle(provider)
          if(assocHandle.Handle == Request.getParameter("openid.assoc_handle") and checkRequestSignature(assocHandle.Key)) {
            for(param in Request.ParameterMap.entrySet()) {
              if(param.Key.startsWith("openid.ns.") and param.Value[0] == "http://openid.net/srv/ax/1.0") {
                var email = Request.getParameter("openid.${param.Key.substring("openid.ns.".length)}.value.email")
                AuthManager.openidLogin(email, Session["__ronin_openid_provider"] as String)
                break
              }
            }
          }
        }
      }
      var redirectURL = Session["__ronin_openid_referrer"] as String
      postLoginRedirect(redirectURL)
    } finally {
      Session["__ronin_openid_nonce"] = null
      Session["__ronin_openid_provider"] = null
      Session["__ronin_openid_referrer"] = null
      Session["__ronin_openid_provider_resolved"] = null
    }
  }

  private function getAssocHandle(provider : String) : AssocHandle {
    var assocHandle = Ronin.cache(\ -> fetchAssocHandle(provider), "__ronin_openid_${provider}", APPLICATION)
    if(System.currentTimeMillis() > assocHandle.expires) {
      assocHandle = fetchAssocHandle(provider)
      Ronin.invalidate("__ronin_openid_${provider}", APPLICATION)
      assocHandle = Ronin.cache(\ -> assocHandle, "__ronin_openid_${provider}", APPLICATION)
    }
    return assocHandle
  }

  private function fetchAssocHandle(provider : String) : AssocHandle {
    var assocResponse = new DefaultHttpClient().execute(new HttpGet(provider +
      "?openid.ns=http://specs.openid.net/auth/2.0" +
      "&openid.mode=associate" +
      "&openid.assoc_type=HMAC-SHA1" +
      "&openid.session_type=no-encryption"
    ))
    var responseText = StreamUtil.getContent(StreamUtil.getInputStreamReader(assocResponse.Entity.Content))
    var assocHandle = new AssocHandle()
    for(responseLine in responseText.split("\n")) {
      if(responseLine.startsWith("assoc_handle:")) {
        assocHandle.Handle = responseLine.substring("assoc_handle:".length)
      } else if(responseLine.startsWith("expires_in:")) {
        assocHandle.Expires = System.currentTimeMillis() + Long.parseLong(responseLine.substring("expires_in:".length)) * 1000
      } else if(responseLine.startsWith("mac_key:")) {
        assocHandle.Key = Base64.decodeBase64(responseLine.substring("mac_key:".length).getBytes("UTF-8"))
      }
    }
    return assocHandle
  }

  private function checkRequestSignature(key : byte[]) : boolean {
    var concatFields = new StringBuilder()
    for(fieldName in Request.getParameter("openid.signed").split(",")) {
      var value = Request.getParameter("openid.${fieldName}")
      if(value != null) {
        concatFields.append("${fieldName}:${value}\n")
      }
    }
    var signingKey = new SecretKeySpec(key, "HmacSHA1")
    var mac = Mac.getInstance("HmacSHA1")
    mac.init(signingKey)
    var rawHmac = mac.doFinal(concatFields.toString().getBytes("UTF-8"))
    var signature = new String(Base64.encodeBase64(rawHmac), "UTF-8")
    print(signature)
    print(Request.getParameter("openid.sig"))
    return slowEquals(signature, Request.getParameter("openid.sig"))
  }

  private static function slowEquals(s1 : String, s2 : String) : boolean {
    if (s1.length != s2.length) {
      return false
    }

    var result = 0
    for (i in 0..|s1.length) {
      result |= (s1.charAt(i) as int) ^ (s2.charAt(i) as int)
    }
    return result == 0
  }

  private static class AssocHandle {
    var _handle : String as Handle
    var _expires : long as Expires
    var _key : byte[] as Key
  }

}