//Signed distance function primitives and operations by Inigo Quilez
//More info and functions can be found at https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

module.exports = `
    float dot2( in vec2 v ) { return dot(v,v); }
    float dot2( in vec3 v ) { return dot(v,v); }
    float ndot( in vec2 a, in vec2 b ) { return a.x*b.x - a.y*b.y; }

    float sdSphere( vec3 p, float s )
    {
        return length(p)-s;
    }

    float sdBox( vec3 p, vec3 b )
    {
        vec3 q = abs(p) - b;
        return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    }

    float sdRoundBox( vec3 p, vec3 b, float r )
    {
        vec3 q = abs(p) - b;
        return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
    }

    float sdBoundingBox( vec3 p, vec3 b, float e )
    {
        p = abs(p  )-b;
        vec3 q = abs(p+e)-e;
        return min(min(
        length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
        length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
        length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
    }

    float sdTorus( vec3 p, vec2 t )
    {
        vec2 q = vec2(length(p.xz)-t.x,p.y);
        return length(q)-t.y;
    }

    float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
    {
        p.x = abs(p.x);
        float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
        return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
    }

    float sdLink( vec3 p, float le, float r1, float r2 )
    {
        vec3 q = vec3( p.x, max(abs(p.y)-le,0.0), p.z );
        return length(vec2(length(q.xy)-r1,q.z)) - r2;
    }

    float sdCylinder( vec3 p, vec3 c )
    {
        return length(p.xz-c.xy)-c.z;
    }

    float sdCone( in vec3 p, in vec2 c, float h )
    {
        // c is the sin/cos of the angle, h is height
        // Alternatively pass q instead of (c,h),
        // which is the point at the base in 2D
        vec2 q = h*vec2(c.x/c.y,-1.0);
            
        vec2 w = vec2( length(p.xz), p.y );
        vec2 a = w - q*clamp( dot(w,q)/dot(q,q), 0.0, 1.0 );
        vec2 b = w - q*vec2( clamp( w.x/q.x, 0.0, 1.0 ), 1.0 );
        float k = sign( q.y );
        float d = min(dot( a, a ),dot(b, b));
        float s = max( k*(w.x*q.y-w.y*q.x),k*(w.y-q.y)  );
        return sqrt(d)*sign(s);
    }

    float sdPlane( vec3 p, vec3 n, float h )
    {
        // n must be normalized
        return dot(p,n) + h;
    }

    float sdHexPrism( vec3 p, vec2 h )
    {
        const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
        p = abs(p);
        p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
        vec2 d = vec2(
            length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x), h.x))*sign(p.y-h.x),
            p.z-h.y );
        return min(max(d.x,d.y),0.0) + length(max(d,0.0));
    }

    float sdTriPrism( vec3 p, vec2 h )
    {
        vec3 q = abs(p);
        return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5);
    }

    float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
    {
        vec3 pa = p - a, ba = b - a;
        float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
        return length( pa - ba*h ) - r;
    }

    float sdVerticalCapsule( vec3 p, float h, float r )
    {
        p.y -= clamp( p.y, 0.0, h );
        return length( p ) - r;
    }

    float sdCappedCylinder( vec3 p, float h, float r )
    {
        vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(h,r);
        return min(max(d.x,d.y),0.0) + length(max(d,0.0));
    }

    float sdRoundedCylinder( vec3 p, float ra, float rb, float h )
    {
        vec2 d = vec2( length(p.xz)-2.0*ra+rb, abs(p.y) - h );
        return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rb;
    }

    float sdCappedCone( vec3 p, float h, float r1, float r2 )
    {
        vec2 q = vec2( length(p.xz), p.y );
        vec2 k1 = vec2(r2,h);
        vec2 k2 = vec2(r2-r1,2.0*h);
        vec2 ca = vec2(q.x-min(q.x,(q.y<0.0)?r1:r2), abs(q.y)-h);
        vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot2(k2), 0.0, 1.0 );
        float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
        return s*sqrt( min(dot2(ca),dot2(cb)) );
    }

    float sdSolidAngle(vec3 p, vec2 c, float ra)
    {
        // c is the sin/cos of the angle
        vec2 q = vec2( length(p.xz), p.y );
        float l = length(q) - ra;
        float m = length(q - c*clamp(dot(q,c),0.0,ra) );
        return max(l,m*sign(c.y*q.x-c.x*q.y));
    }

    float sdRoundCone( vec3 p, float r1, float r2, float h )
    {
        vec2 q = vec2( length(p.xz), p.y );
            
        float b = (r1-r2)/h;
        float a = sqrt(1.0-b*b);
        float k = dot(q,vec2(-b,a));
            
        if( k < 0.0 ) return length(q) - r1;
        if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
                
        return dot(q, vec2(a,b) ) - r1;
    }

    float sdEllipsoid( vec3 p, vec3 r )
    {
        float k0 = length(p/r);
        float k1 = length(p/(r*r));
        return k0*(k0-1.0)/k1;
    }

    float sdRhombus(vec3 p, float la, float lb, float h, float ra)
    {
        p = abs(p);
        vec2 b = vec2(la,lb);
        float f = clamp( (ndot(b,b-2.0*p.xz))/dot(b,b), -1.0, 1.0 );
        vec2 q = vec2(length(p.xz-0.5*b*vec2(1.0-f,1.0+f))*sign(p.x*b.y+p.z*b.x-b.x*b.y)-ra, p.y-h);
        return min(max(q.x,q.y),0.0) + length(max(q,0.0));
    }

    float sdOctahedron( vec3 p, float s)
    {
        p = abs(p);
        float m = p.x+p.y+p.z-s;
        vec3 q;
            if( 3.0*p.x < m ) q = p.xyz;
        else if( 3.0*p.y < m ) q = p.yzx;
        else if( 3.0*p.z < m ) q = p.zxy;
        else return m*0.57735027;
            
        float k = clamp(0.5*(q.z-q.y+s),0.0,s); 
        return length(vec3(q.x,q.y-s+k,q.z-k)); 
    }

    float sdPyramid( vec3 p, float h)
    {
        float m2 = h*h + 0.25;
            
        p.xz = abs(p.xz);
        p.xz = (p.z>p.x) ? p.zx : p.xz;
        p.xz -= 0.5;

        vec3 q = vec3( p.z, h*p.y - 0.5*p.x, h*p.x + 0.5*p.y);
        
        float s = max(-q.x,0.0);
        float t = clamp( (q.y-0.5*p.z)/(m2+0.25), 0.0, 1.0 );
            
        float a = m2*(q.x+s)*(q.x+s) + q.y*q.y;
        float b = m2*(q.x+0.5*t)*(q.x+0.5*t) + (q.y-m2*t)*(q.y-m2*t);
            
        float d2 = min(q.y,-q.x*m2-q.y*0.5) > 0.0 ? 0.0 : min(a,b);
            
        return sqrt( (d2+q.z*q.z)/m2 ) * sign(max(q.z,-p.y));
    }

    float udTriangle( vec3 p, vec3 a, vec3 b, vec3 c )
    {
        vec3 ba = b - a; vec3 pa = p - a;
        vec3 cb = c - b; vec3 pb = p - b;
        vec3 ac = a - c; vec3 pc = p - c;
        vec3 nor = cross( ba, ac );

        return sqrt(
            (sign(dot(cross(ba,nor),pa)) +
            sign(dot(cross(cb,nor),pb)) +
            sign(dot(cross(ac,nor),pc))<2.0)
            ?
            min( min(
            dot2(ba*clamp(dot(ba,pa)/dot2(ba),0.0,1.0)-pa),
            dot2(cb*clamp(dot(cb,pb)/dot2(cb),0.0,1.0)-pb) ),
            dot2(ac*clamp(dot(ac,pc)/dot2(ac),0.0,1.0)-pc) )
            :
            dot(nor,pa)*dot(nor,pa)/dot2(nor) );
    }

    float udQuad( vec3 p, vec3 a, vec3 b, vec3 c, vec3 d )
    {
        vec3 ba = b - a; vec3 pa = p - a;
        vec3 cb = c - b; vec3 pb = p - b;
        vec3 dc = d - c; vec3 pc = p - c;
        vec3 ad = a - d; vec3 pd = p - d;
        vec3 nor = cross( ba, ad );

        return sqrt(
            (sign(dot(cross(ba,nor),pa)) +
            sign(dot(cross(cb,nor),pb)) +
            sign(dot(cross(dc,nor),pc)) +
            sign(dot(cross(ad,nor),pd))<3.0)
            ?
            min( min( min(
            dot2(ba*clamp(dot(ba,pa)/dot2(ba),0.0,1.0)-pa),
            dot2(cb*clamp(dot(cb,pb)/dot2(cb),0.0,1.0)-pb) ),
            dot2(dc*clamp(dot(dc,pc)/dot2(dc),0.0,1.0)-pc) ),
            dot2(ad*clamp(dot(ad,pd)/dot2(ad),0.0,1.0)-pd) )
            :
            dot(nor,pa)*dot(nor,pa)/dot2(nor) );
    }

    float opUnion( float d1, float d2 ) {  return min(d1,d2); }

    float opSubtraction( float d1, float d2 ) { return max(-d1,d2); }

    float opIntersection( float d1, float d2 ) { return max(d1,d2); }

    float opSmoothUnion( float d1, float d2, float k ) {
        float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
        return mix( d2, d1, h ) - k*h*(1.0-h); }

    float opSmoothSubtraction( float d1, float d2, float k ) {
        float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
        return mix( d2, -d1, h ) + k*h*(1.0-h); }

    float opSmoothIntersection( float d1, float d2, float k ) {
        float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
        return mix( d2, d1, h ) + k*h*(1.0-h); }
`