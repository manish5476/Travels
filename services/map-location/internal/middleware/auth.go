package middleware
 
import (
    "crypto/rsa"
    "crypto/x509"
    "encoding/pem"
    "fmt"
    "net/http"
    "strings"
    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
    "github.com/tripparty/map-service/config"
)
 
var publicKey *rsa.PublicKey
 
func init() {
    block, _ := pem.Decode([]byte(config.C.JWTPublicKey))
    if block == nil { panic("❌ Failed to decode JWT public key PEM") }
    key, err := x509.ParsePKIXPublicKey(block.Bytes)
    if err != nil { panic("❌ Invalid JWT public key: " + err.Error()) }
    var ok bool
    publicKey, ok = key.(*rsa.PublicKey)
    if !ok { panic("❌ JWT public key is not RSA") }
}
 
type Claims struct {
    UserID   string   `json:"userId"`
    DeviceID string   `json:"deviceId"`
    Roles    []string `json:"roles"`
    jwt.RegisteredClaims
}
 
// AuthMiddleware validates RS256 JWT and sets user in Gin context
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        header := c.GetHeader("Authorization")
        if !strings.HasPrefix(header, "Bearer ") {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
                "success": false, "code": "UNAUTHORIZED", "message": "Missing token",
            })
            return
        }
        tokenStr := strings.TrimPrefix(header, "Bearer ")
        claims   := &Claims{}
        _, err   := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
            if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
            }
            return publicKey, nil
        })
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
                "success": false, "code": "UNAUTHORIZED", "message": "Invalid or expired token",
            })
            return
        }
        c.Set("userId",   claims.UserID)
        c.Set("deviceId", claims.DeviceID)
        c.Set("roles",    claims.Roles)
        c.Next()
    }
}
 
// InternalMiddleware validates x-internal-secret header (service-to-service)
func InternalMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        if c.GetHeader("x-internal-secret") != config.C.InternalSecret {
            c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
                "success": false, "code": "FORBIDDEN", "message": "Internal access only",
            })
            return
        }
        c.Next()
    }
}
